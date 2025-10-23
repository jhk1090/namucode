const { highlight } = require('highlight.js');
const { getQuickJS } = require("quickjs-emscripten")
const fs = require('fs');
const path = require('path');

const utils = require('./utils');
const mainUtils = require('./mainUtil'); // ../global 이였으나, ../로 통합
const parser = require("./parserWorker")

const link = require('./syntax/link');
const macro = require('./syntax/macro');
const table = require('./syntax/table');

let MAXIMUM_LENGTH = 5000000;
const jsGlobalRemover = fs.readFileSync(path.join(__CORE_DIR__, "utils/jsGlobalRemover.js"), 'utf8');

const topToHtml = module.exports = async parameter => {
  if(parameter[0]?.batch) return await Promise.all(parameter[0].batch.map(a => topToHtml(a)));

  const [parsed, options = {}] = parameter;
  const { includeData = null, config = {}, document, workspaceDocuments } = options;

  if (config.maxLength) {
    MAXIMUM_LENGTH = config.maxLength
  }

  let qjs;
  let qjsContext;
  if (options.Store == null) {
    qjs = await getQuickJS();
    qjsContext = qjs.newContext();
  }
  const Store = (options.Store ??= {
    config,
    workspaceDocuments: workspaceDocuments ?? [],
    parsedIncludes: [],
    links: [],
    files: [],
    categories: [],
    heading: {
      list: [],
      html: "",
    },
    error: null,
    errorCode: null,
    macro: {
      counts: {},
    },
    embed: {
      text: null,
      image: null,
    },
    qjs,
    qjsContext,
    ...(options.StorePatch ?? {}),
  });

  const toHtml = (doc, newOptions) =>
    topToHtml([
      doc,
      {
        ...options,
        ...newOptions,
        skipInit: true,
      },
    ]);

  const isTop = !!parsed?.result;
  let doc = isTop ? parsed.result : parsed;

  if (!isTop && !Array.isArray(doc)) doc = [doc];

  if (!isTop && !parsed) return "";

  // if (Array.isArray(doc[0])) {
  //   const lines = [];
  //   for (let line of doc) {
  //     lines.push(await toHtml(line));
  //   }
  //   return lines.join("<br>");
  // }

  if (isTop) {
    const removerHandle = Store.qjsContext.evalCode(jsGlobalRemover);
    removerHandle.dispose()
    if(includeData)
      await Promise.all(Object.entries(includeData).map(([key, value]) => {
        const valueHandle = Store.qjsContext.newString(value)
        Store.qjsContext.setProp(Store.qjsContext.global, key, valueHandle)
        valueHandle.dispose()
      }));

    // console.log("includedata", JSON.stringify(includeData))
    // console.log("global", JSON.stringify(Store.qjsContext.dump(Store.qjsContext.global)))
  }

  if(parsed.data && !options.skipInit) {
      const includeParams = [];
      for (let [docName, params] of Object.entries(parsed.data.includeParams)) {
          const parsedName = mainUtils.parseDocumentName(docName);
          let doc = includeParams.find((a) => a.namespace === parsedName.namespace && a.title === parsedName.title);
          if (!doc) {
              doc = {
                  ...parsedName,
                  params: [],
              };
              includeParams.push(doc);
          }
          doc.params.push(...params);
      }

      const parsedDocAdder = async (result, parsedDocs = [], includeParams = []) => {
          const links = [...new Set([...result.data.links, ...result.data.categories.map((a) => "분류:" + a.document), ...result.data.includes])];

          const paramLinks = links.filter((a) => a.includes("@"));
          if (includeParams.length) {
              for (let link of paramLinks) {
                  for (let params of includeParams) {
                      const newLink = await utils.parseIncludeParams(link, null, params);
                      if (!links.includes(newLink)) links.push(newLink);
                  }
              }
          } else {
              for (let link of paramLinks) {
                  const newLink = await utils.parseIncludeParams(link);
                  if (!links.includes(newLink)) links.push(newLink);
              }
          }

          for (let link of links) {
              if (link.startsWith(":")) {
                  const slicedLink = link.slice(1);
                  if (utils.AllowedNamespace.some((a) => slicedLink.startsWith(a + ":"))) link = slicedLink;
              }
              if (document) {
                  const docTitle = mainUtils.doc_fulltitle(document);
                  if (link.startsWith("../")) {
                      link = link.slice(3);

                      const splittedDocument = docTitle.split("/");
                      splittedDocument.pop();
                      const document = splittedDocument.join("/");
                      link = `${document}${document && link ? "/" : ""}${link}`;

                      link ||= docTitle;
                  } else if (link.startsWith("/")) link = docTitle + link;
              }

              const item = mainUtils.parseDocumentName(link);
              if (!parsedDocs.some((a) => a.namespace === item.namespace && a.title === item.title)) parsedDocs.push(item);

              if (result.data.includes.includes(link)) item.isInclude = true;
          }
          return parsedDocs;
      };

      const topDocs = await parsedDocAdder(parsed);
      const includeDocs = [];
      for (let docName of topDocs.filter((a) => a.isInclude)) {
          const doc = Store.workspaceDocuments.find((a) => a.namespace === docName.namespace && a.title === docName.title);
          if (!doc) continue;

          const params = includeParams.find((a) => a.namespace === docName.namespace && a.title === docName.title)?.params ?? [];
          doc.parseResult = parser(doc.content, { maxParsingDepth: config.maxParsingDepth ?? null });
          await parsedDocAdder(doc.parseResult, includeDocs, params);
      }

      Store.categories = parsed.data.categories;
      for (let obj of Store.categories) {
          const cache = Store.workspaceDocuments.find((cache) => cache.namespace === "분류" && cache.title === obj.document);
          obj.notExist = cache === undefined;
      }
  }

  if (isTop) {
    let html = '<div class="wiki-macro-toc">';
    let indentLevel = 0;
    for (let heading of parsed.data.headings) {
      const prevIndentLevel = indentLevel;
      indentLevel = heading.actualLevel;

      const indentDiff = Math.abs(indentLevel - prevIndentLevel);

      if (indentLevel !== prevIndentLevel)
        for (let i = 0; i < indentDiff; i++) html += indentLevel > prevIndentLevel ? '<div class="toc-indent">' : "</div>";

      html += `<span class="toc-item"><a href="#s-${heading.numText}">${heading.numText}</a>. ${await toHtml(heading.linkText)}</span>`;

      Store.heading.list.push({
        level: heading.level,
        num: heading.numText,
        title: utils.unescapeHtml(await toHtml(heading.pureText)),
        anchor: `s-${heading.numText}`,
      });
    }
    for (let i = 0; i < indentLevel + 1; i++) html += "</div>";

    Store.heading.html = html;
  }

  let result = "";
  for (let obj of doc) {
    if (Store.error) break;

    if (Array.isArray(obj)) {
      const lines = [];
      for (let line of obj) {
        lines.push(await toHtml(line));
      }
      result += lines.join("");
      continue;
    }

    switch (obj.type) {
      case "paragraph": {
        result += `<div class="wiki-paragraph">${await toHtml(obj.lines)}</div>`;
        break;
      }

      case "heading": {
        const text = await toHtml(obj.text);

        result += `<h${obj.level} class="wiki-heading${obj.closed ? " wiki-heading-folded" : ""}">`;
        result += `<a id="s-${obj.numText}" href="#toc">${obj.numText}.</a>`;
        result += ` <span id="${mainUtils.removeHtmlTags(text)}">${text}`;
        result += `</span></h${obj.level}>`;
        result += `<div class="wiki-heading-content${obj.closed ? " wiki-heading-content-folded" : ""}">`;
        result += await toHtml(obj.content);
        result += `</div>`;
        break;
      }
      case "table":
        result += await table(obj, toHtml);
        break;
      case "indent":
        result += `<div class="wiki-indent">${await toHtml(obj.content)}</div>`;
        break;
      case "blockquote":
        result += `<blockquote class="wiki-quote">${await toHtml(obj.content)}</blockquote>`;
        break;
      case "hr":
        result += "<hr>";
        break;
      case "list": {
        const tagName = obj.listType === "*" ? "ul" : "ol";
        const listClass = {
          "*": "",
          1: "",
          a: "wiki-list-alpha",
          A: "wiki-list-upper-alpha",
          i: "wiki-list-roman",
          I: "wiki-list-upper-roman",
        }[obj.listType];
        result += `<${tagName} class="wiki-list${listClass ? ` ${listClass}` : ""}"${tagName === "ol" ? ` start="${obj.startNum}"` : ""}>`;
        for (let item of obj.items) {
          result += `<li>${await toHtml(item)}</li>`;
        }
        result += `</${tagName}>`;
        break;
      }

      case "wikiSyntax":
        let wikiParamsStr = await utils.parseIncludeParams(obj.wikiParamsStr, Store.qjsContext);

        const styleCloseStr = '"';

        const darkStyleOpenStr = 'dark-style="';
        const darkStyleIndex = wikiParamsStr.indexOf(darkStyleOpenStr);
        const darkStyleEndIndex = wikiParamsStr.indexOf(styleCloseStr, darkStyleIndex + darkStyleOpenStr.length);
        let darkStyle;
        if (darkStyleIndex >= 0 && darkStyleEndIndex >= 0) {
          darkStyle = wikiParamsStr.slice(darkStyleIndex + darkStyleOpenStr.length, darkStyleEndIndex);
          wikiParamsStr = wikiParamsStr.slice(0, darkStyleIndex) + wikiParamsStr.slice(darkStyleEndIndex + styleCloseStr.length);
        }

        const styleOpenStr = 'style="';
        const styleIndex = wikiParamsStr.indexOf(styleOpenStr);
        const styleEndIndex = wikiParamsStr.indexOf('"', styleIndex + styleOpenStr.length);
        let style;
        if (styleIndex >= 0 && styleEndIndex >= 0) {
          style = wikiParamsStr.slice(styleIndex + styleOpenStr.length, styleEndIndex);
        }

        style = utils.cssFilter(style);
        darkStyle = utils.cssFilter(darkStyle);

        result += `<div${style ? ` style="${style}"` : ""}${darkStyle ? ` data-dark-style="${darkStyle}"` : ""}>${await toHtml(obj.content)}</div>`;
        break;
      case "syntaxSyntax":
        result += `<pre><code>${highlight(obj.content, { language: obj.lang }).value}</code></pre>`;
        break;
      case "htmlSyntax":
        result += utils.sanitizeHtml(await utils.parseIncludeParams(obj.text, Store.qjsContext));
        break;
      case "folding":
        result += `<dl class="wiki-folding"><dt>${utils.escapeHtml(obj.text)}</dt><dd class="wiki-folding-close-anim">${await toHtml(
          obj.content
        )}</dd></dl>`;
        break;
      case "ifSyntax":
        if (!utils.checkJavascriptValid(obj.expression)) break;
        let evalResult;
        let handle;
        try {
          let aborted = false;
          handle = Store.qjsContext.evalCode(`with(safeGlobal){${obj.expression}}`, {
            shouldInterrupt: () => aborted,
          })
          setTimeout(() => (aborted = true), 100);
          evalResult = Store.qjsContext.dump(handle.value)
        } catch (e) {}
        finally {
          handle.dispose()
        }
        if (evalResult) result += await toHtml(obj.content);
        break;

      case "text":
        result += utils.escapeHtml(await utils.parseIncludeParams(obj.text, Store.qjsContext)).replaceAll("\n", "<br>");
        break;
      case "bold":
        result += `<strong>${await toHtml(obj.content)}</strong>`;
        break;
      case "italic":
        result += `<em>${await toHtml(obj.content)}</em>`;
        break;
      case "strike":
        result += `<del>${await toHtml(obj.content)}</del>`;
        break;
      case "underline":
        result += `<u>${await toHtml(obj.content)}</u>`;
        break;
      case "sup":
        result += `<sup>${await toHtml(obj.content)}</sup>`;
        break;
      case "sub":
        result += `<sub>${await toHtml(obj.content)}</sub>`;
        break;
      case "legacyMath":
        result += utils.katex(obj.content);
        break;
      case "commentNumber":
        result += `<a href="#${obj.num}" class="wiki-self-link">#${obj.num}</a>`;
        break;
      case "scaleText":
        result += `<span class="wiki-size-${obj.isSizeUp ? "up" : "down"}-${obj.size}">${await toHtml(obj.content)}</span>`;
        break;
      case "colorText":
        result += `<span${obj.color ? ` style="color:${obj.color}"` : ""}${
          obj.darkColor ? ` data-dark-style="color:${obj.darkColor}"` : ""
        }>${await toHtml(obj.content)}</span>`;
        break;
      case "literal": {
        const hasNewline = obj.text.includes("\n");
        const text = utils.escapeHtml(obj.text).replaceAll("\n", "<br>");
        if (hasNewline) result += "<pre>";
        result += `<code>${text}</code>`;
        if (hasNewline) result += "</pre>";
        break;
      }
      case "link":
        result += await link(obj, {
          document,
          toHtml,
          Store,
          includeData,
          workspaceDocuments: Store.workspaceDocuments
        });
        break;
      case "macro":
        obj.params = await utils.parseIncludeParams(obj.params, Store.qjsContext);
        result += await macro(obj, {
          toHtml,
          Store,
          heading: Store.heading,
          includeData,
          workspaceDocuments: Store.workspaceDocuments
        });
        break;
      case "footnote": {
        const name = obj.name;
        const value = await toHtml(obj.value);
        result += `<a class="wiki-fn-content" title="${mainUtils.removeHtmlTags(value)}" href="#fn-${name}"><span id="rfn-${
          obj.index
        }"></span>[${name}]</a>`;
        break;
      }

      default:
        console.trace();
        console.error("missing implementation:", obj.type);
    }

    if (result.length > MAXIMUM_LENGTH) {
      throw new Error("render_too_long")
    }
  }

  if (Store.error) result = Store.error;

  if (isTop) {
    if(!includeData) {
        const hasHeading = parsed.result.some((a) => a.type === "heading");
        const target = hasHeading
            ? parsed.result
                  .filter((a) => a.type === "heading")
                  .map((a, i) => {
                      const result = [];
                      if (i) result.push(a.text);
                      result.push(a.content);
                      return result;
                  })
            : parsed.result;
        const embedText = utils.parsedToText(target, true);
        Store.embed.text = embedText.replaceAll("\n", " ").replaceAll("  ", " ").trim().slice(0, 200);
    }

    Store.qjsContext.dispose();


    return {
      html: Store.error ? `<h2>${result}</h2>` : result,
      errorMsg: result,
      errorCode: Store.errorCode,
      links: Store.links,
      files: Store.files,
      categories: Store.categories,
      headings: Store.heading.list,
      hasError: !!Store.error,
      embed: Store.embed,
    };
  }
  return result;
}
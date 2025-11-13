module.exports = {
  parseDocumentName(name, getNamespaceExists = false) {
    // config.namespaces = []
    name = name.slice(0, 255);
    const originalName = name.trim();
    const splitedName = originalName.split(":");
    const probablyNamespace = splitedName.length > 1 ? splitedName[0] : null;
    const namespaceExists = [].includes(probablyNamespace);
    const namespace = namespaceExists ? probablyNamespace : "문서";
    let title = namespaceExists ? splitedName.slice(1).join(":") : originalName;

    let forceShowNamespace = null;

    const splitedTitle = title.split(":");
    const splitedTitleNamespace = splitedTitle.length > 1 ? splitedTitle[0] : null;
    if ([].includes(splitedTitleNamespace)) forceShowNamespace = true;
    else if (namespace === "문서") forceShowNamespace = false;

    // let anchor;
    // if(title.includes('#')) {
    //     const splittedTitle = title.split('#');
    //     anchor = splittedTitle.pop();
    //     title = splittedTitle.join('#');
    // }

    return {
      namespace,
      title,
      forceShowNamespace,
      ...(getNamespaceExists
        ? {
            namespaceExists,
          }
        : {}),
      // anchor
    };
  },
  doc_fulltitle(document) {
    const type = typeof document;

    if (type === "object") {
      if (document.forceShowNamespace === false) return document.title;
      return `${document.namespace}:${document.title}`;
    } else return document;
  },
  doc_action_link(document, route, query = {}) {
    if (typeof specialUrls === "undefined") specialUrls = [".", "..", "\\"];

    const title = this.doc_fulltitle(document);
    let str;
    if (specialUrls.includes(title) || route.startsWith("a/")) {
      query.doc = encodeURIComponent(title);
      str = `/${route}/`;
    } else str = `/${route}/${this.encodeSpecialChars(title)}`;
    if (Object.keys(query).length > 0) {
      str += "?";
      str += Object.keys(query)
        .filter((k) => query[k])
        .map((k) => `${k}=${encodeURIComponent(query[k])}`)
        .join("&");
    }

    if (query.internalLinkDomain) {
      return query.internalLinkDomain + str
    }
    return str;
  },
  encodeSpecialChars(str, exclude = []) {
    if (!str) return str;

    if (typeof specialChars === "undefined") specialChars = "?&=+$#%\\".split("");
    return str
      .split("")
      .map((a) => (specialChars.includes(a) && !exclude.includes(a) ? encodeURIComponent(a) : a))
      .join("");
  },
  removeHtmlTags(text) {
    return text.replaceAll(/<[^>]+>/g, "");
  },
  getFullDateTag(date, type) {
    if (!date) return;

    let dateStr = "";
    let isoStr = "";
    if (typeof dayjs !== "undefined") {
      const dateObj = dayjs.utc(date);
      isoStr = dateObj.toISOString();
      dateStr = dateObj.format("YYYY-MM-DD HH:mm:ss");
    } else {
      if (typeof date === "string") date = new Date(date);
      isoStr = date.toISOString();
      dateStr = this.getTimeStr(date);
    }

    return `<time${type ? ` data-type="${type}"` : ""} datetime="${isoStr}">${dateStr}</time>`;
  },
  getTimeStr(date) {
    const dateStr = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((num) => num.toString().padStart(2, "0")).join("-");

    const timeStr = [date.getHours(), date.getMinutes(), date.getSeconds()].map((num) => num.toString().padStart(2, "0")).join(":");

    return dateStr + " " + timeStr;
  },
};
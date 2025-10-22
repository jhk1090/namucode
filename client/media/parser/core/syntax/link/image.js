const querystring = require('querystring');

const utils = require('../../utils');
const mainUtils = require('../../mainUtil');

module.exports = async (obj, link, { Store, document: docDocument, dbDocument: docDbDocument, rev: docRev, includeData, disableImageLinkButton }) => {
    const document = mainUtils.parseDocumentName(obj.link);
    let { namespace, title } = document;

    if(!title.startsWith('파일:')) return;

    title = document.title = await utils.parseIncludeParams(title, Store.qjsContext);

    const options = !obj.textExists ? {} : querystring.parse(obj.text);

    const fallback = {
        link,
        text: link
    }
    const result = Store.workspaceDocuments.find(a => a.namespace === namespace && a.title === title);
    if (!result) {
        return fallback;
    }
    // if(checkCache && checkCache.rev?.document !== docRev?.document) {
    //     if(!checkCache.readable) return fallback;
    //     if(!checkCache.rev.fileKey) return fallback;
    //     rev = checkCache.rev;
    // }
    // else {
    //     // let dbDocument;
    //     // let readable = false;
    //     if(namespace === docDbDocument?.namespace
    //         && title === docDbDocument?.title
    //         && docRev?.fileKey) {
    //         // dbDocument = docDbDocument;
    //         rev = docRev;
    //         // readable = true;
    //     }

    //     if(!rev?.fileKey) return fallback;
    // }

    const imgUrl = new URL(result.content.fileKey);
    if(!includeData) Store.embed.image ??= imgUrl.toString();

    options.borderRadius = options['border-radius'];
    delete options['border-radius'];

    let widthUnit = 'px';
    let heightUnit = 'px';
    let borderRadiusUnit = 'px';

    if(options.width?.endsWith('%')) {
        widthUnit = '%';
        options.width = options.width.slice(0, -1);
    }
    if(options.height?.endsWith('%')) {
        heightUnit = '%';
        options.height = options.height.slice(0, -1);
    }
    if(options.borderRadius?.endsWith('%')) {
        borderRadiusUnit = '%';
        options.borderRadius = options.borderRadius.slice(0, -1);
    }

    const parseFrontInt = str => {
        if(str == null) return NaN;

        str = str.split('');
        let result = '';
        while(!isNaN(str[0])) result += str.shift();
        return parseInt(result);
    }

    options.width = parseFrontInt(options.width);
    options.height = parseFrontInt(options.height);
    options.borderRadius = parseFrontInt(options.borderRadius);

    if(isNaN(options.width)) delete options.width;
    if(isNaN(options.height)) delete options.height;
    if(isNaN(options.borderRadius)) delete options.borderRadius;

    if(![
        'bottom',
        'center',
        'left',
        'middle',
        'normal',
        'right',
        'top'
    ].includes(options.align)) delete options.align;

    if(!utils.validateColor(options.bgcolor)) delete options.bgcolor;

    if(![
        'light',
        'dark'
    ].includes(options.theme)) delete options.theme;

    if(![
        'auto',
        'smooth',
        'high-quality',
        'pixelated',
        'crisp-edges'
    ].includes(options.rendering)) delete options.rendering;

    const imgSpanClassList = [`wiki-image-align${options.align ? `-${options.align}` : ''}`];
    let imgSpanStyle = ``;
    let imgWrapperStyle = ``;
    let imgAttrib = ``;
    let imgStyle = ``;

    if(options.width) {
        imgSpanStyle += `width:${options.width}${widthUnit};`;
        imgWrapperStyle += `width: 100%;`;
        imgAttrib += ` width="100%"`;
    }
    if(options.height) {
        imgSpanStyle += `height:${options.height}${heightUnit};`;
        imgWrapperStyle += `height: 100%;`;
        imgAttrib += ` height="100%"`;
    }

    if(options.bgcolor) imgWrapperStyle += `background-color:${options.bgcolor};`;

    if(options.borderRadius) imgStyle += `border-radius:${options.borderRadius}${borderRadiusUnit};`;
    if(options.rendering) imgStyle += `image-rendering:${options.rendering};`;

    if(options.theme) imgSpanClassList.push(`wiki-theme-${options.theme}`);

    const fullTitle = utils.escapeHtml(mainUtils.doc_fulltitle(document));

    // TODO: over 1MB remove option, loading lazy config
    return `
<span class="${imgSpanClassList.join(' ')}" style="${imgSpanStyle}">
<span class="wiki-image-wrapper" style="${imgWrapperStyle}">
<img${imgAttrib} style="${imgStyle}" src="data:image/svg+xml;base64,${Buffer.from(`<svg width="${result.content.fileWidth}" height="${result.content.fileHeight}" xmlns="http://www.w3.org/2000/svg"></svg>`).toString('base64')}">
<img class="wiki-image"${imgAttrib} style="${imgStyle}" src="${imgUrl}" alt="${fullTitle}" data-filesize="${result.content.fileSize}" data-src="${imgUrl}" data-doc="${fullTitle}" loading="lazy">
${disableImageLinkButton || (docDocument.namespace === namespace && docDocument.title === title) 
    ? '' 
    : `<a class="wiki-image-info" href="${utils.escapeHtml(mainUtils.doc_action_link(document, 'w'))}" rel="nofollow noopener"></a>`
}
</span>
</span>`.replaceAll('\n', '');
}
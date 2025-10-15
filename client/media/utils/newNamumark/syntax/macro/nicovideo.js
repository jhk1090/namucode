const utils = require('../../utils');

module.exports = params => {
    params = params.split(',').map(param => param.trim());

    let videoId = params.shift();

    let width = '720';
    let height = '480';
    let start;
    let end;
    for(let param of params) {
        if(param.startsWith('width=')) {
            const value = param.substring('width='.length);
            let checkStr = value;
            if(checkStr.endsWith('%')) checkStr = value.slice(0, -1);
            if(!isNaN(checkStr)) width = value;
        }
        else if(param.startsWith('height=')) {
            const value = param.substring('height='.length);
            if(!isNaN(value)) height = value;
        }
    }

    if(!videoId) return;

    if(!videoId.startsWith('sm')) videoId = `sm${videoId}`;

    videoId = utils.escapeHtml(videoId);
    width = utils.escapeHtml(width);
    height = utils.escapeHtml(height);

    return `<iframe class="wiki-media" allowfullscreen${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''} frameborder="0" src="//embed.nicovideo.jp/watch/${videoId}" loading="lazy"></iframe>`;
}
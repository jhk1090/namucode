const utils = require('../../utils');

module.exports = (params, options, obj) => {
    params = obj.splittedParams;

    let text = params.shift();

    let ruby;
    let color;
    for(let param of params) {
        if(param.startsWith('color=')) {
            color = param.substring('color='.length);
            if(!utils.validateColor(color)) color = undefined;
        }
        else if(param.startsWith('ruby=')) ruby = param.substring('ruby='.length);
    }

    if(!text || !ruby) return '';

    text = utils.escapeHtml(text);
    ruby = utils.escapeHtml(ruby);

    return `<ruby>${text}<rp>(</rp><rt><span${color ? ` style="color:${color}"` : ''}>${ruby}</span></rt><rp>)</rp></ruby>`;
}
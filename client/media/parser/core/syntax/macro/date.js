const mainUtils = require('../../mainUtil');

module.exports = {
    aliases: ['datetime'],
    format() {
        return mainUtils.getFullDateTag(new Date(), 'timezone');
    }
}
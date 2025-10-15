import fs from 'fs'
import path from 'path'

export default function metadata(data, metadataPath) {
    return {
        name: 'thetree-metadata',
        closeBundle() {
            fs.writeFileSync(path.join(metadataPath, 'metadata.json'), JSON.stringify(data, null, 2))
        }
    }
}
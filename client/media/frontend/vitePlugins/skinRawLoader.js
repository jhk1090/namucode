import path from 'path'
import fs from 'fs'

export default function skinRawLoaderPlugin(skin) {
    return {
        name: 'raw-loader',
        enforce: 'pre',
        resolveId(source) {
            if(source.startsWith('raw-loader!'))
                return source
            return null
        },
        load(id) {
            if (id.startsWith('raw-loader!')) {
                const filePath = id.replace('raw-loader!', '')
                const directory = path.join('./skins', skin)
                const resolvedPath = path.resolve(directory, filePath)
                const content = fs.readFileSync(resolvedPath, 'utf-8')
                return `export default ${JSON.stringify(content)}`
            }
            return null
        }
    }
}
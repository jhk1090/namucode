export default {
    data() {
        return {
            headings: null,
            lastTitle: ''
        }
    },
    async mounted() {
        await this.$nextTick()
        this.updateHeadings()
    },
    watch: {
        async $route() {
            await this.$nextTick()
            this.updateHeadings()
        }
    },
    methods: {
        updateHeadings() {
            const page = this.$store.state.page
            if(page?.viewName !== 'wiki') {
                this.headings = null
                this.lastTitle = ''
                return
            }

            const currTitle = page.data?.document?.title
            if(currTitle === this.lastTitle && this.headings) return

            this.headings = []
            this.lastTitle = currTitle

            const clientHeight = document.body.clientHeight
            const bodyRect = document.body.getBoundingClientRect()

            const allHeadings = []
            for(let item of this.data.headings) {
                const elem = document.getElementById(item.anchor)
                const top = elem.getBoundingClientRect().top - bodyRect.top
                allHeadings.push({ ...item, top })
            }

            const levelCounts = {}
            for(let item of allHeadings) {
                levelCounts[item.level] ??= 0
                levelCounts[item.level]++
            }

            let maxLevel = Math.max(...Object.keys(levelCounts).map(a => parseInt(a)))
            for(let level = maxLevel; level >= 1; level--) {
                const sum = Object.entries(levelCounts)
                    .filter(([key]) => key <= level)
                    .reduce((acc, [_, value]) => acc + value, 0)
                if(sum < 30) {
                    maxLevel = sum < 1 ? level + 1 : level
                    break
                }
            }

            const filtered = allHeadings.filter(item => item.level <= maxLevel)
            if(filtered.length) {
                const gap = 30 * (clientHeight / innerHeight)
                for(let i = 0; i < filtered.length; i++) {
                    let t = filtered[i].top
                    const prevLimit = (i ? filtered[i - 1].top : 0) + gap
                    t = Math.max(prevLimit, t)
                    const remaining = filtered.length - i
                    if((clientHeight - gap - t) / remaining <= gap)
                        t = Math.max(
                            prevLimit,
                            -gap * remaining + (clientHeight - gap)
                        )
                    filtered[i].top = t
                }
            }

            this.headings = filtered.map(a => ({
                ...a,
                top: (a.top / clientHeight * 100).toFixed(2) + '%'
            }))
        }
    }
}
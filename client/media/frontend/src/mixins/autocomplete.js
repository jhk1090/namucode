import Common from '@/mixins/common'

export default {
    mixins: [Common],
    data() {
        return {
            searchText: '',
            searchTextModel: '',
            showList: false,
            cursor: -1,
            internalItems: this.items || [],
            value: null,
            minLen: 1,
            wait: 50,
            items: [],
            controller: null,
            timeout: null
        }
    },
    computed: {
        hasItems() {
            return !!this.internalItems.length
        },
        show() {
            return this.showList && this.hasItems
        }
    },
    created() {
        this.onSelectItem(this.value)
    },
    watch: {
        items(newValue) {
            this.setItems(newValue)
            const item = this.findItem(this.items, this.searchText, false)
            if(item) {
                this.onSelectItem(item)
                this.showList = false
            }
        },
        value(newValue) {
            if(!this.isSelectedValue(newValue)) {
                this.onSelectItem(newValue)
                this.searchTextModel = this.getLabel(newValue)
            }
        }
    },
    methods: {
        callUpdateItems(searchText, afterWait) {
            if(this.timeout) {
                clearTimeout(this.timeout)
                this.timeout = null
            }
            if(searchText.length) this.timeout = setTimeout(afterWait, this.wait)
            else this.items = []
        },
        findItem(items, searchText, getFirst) {
            return getFirst && items.length === 1 ? items[0] : undefined
        },
        getLabel(label) {
            return label
        },
        inputChange() {
            this.showList = true
            this.cursor = -1
            this.onSelectItem(null, 'inputChange')
            this.callUpdateItems(this.searchText, () => this.updateItems())
        },
        async updateItems() {
            if(this.controller) {
                this.controller.abort()
                await this.$nextTick()
            }
            this.controller = new AbortController()

            try {
                this.items = Object.values(await this.internalRequest(`/Complete?q=${encodeURIComponent(this.searchText)}`, {
                    signal: this.controller.signal,
                    noProgress: true
                }))
            } catch(e) {
            } finally {
                this.controller = null
            }
        },
        focus() {
            this.showList = true
        },
        blur() {
            setTimeout(() => this.showList = false, 200)
        },
        onClickItem(item) {
            this.onSelectItem(item)
        },
        onSelectItem(item) {
            if(item) {
                this.internalItems = [item]
                this.searchTextModel = this.getLabel(item)

                this.$router.push(this.doc_action_link(item, 'w'))
            }
            else {
                this.setItems(this.items)
            }
        },
        setItems(items) {
            this.internalItems = items || []
        },
        isSelectedValue(item) {
            return this.internalItems.length === 1 && item === this.internalItems[0]
        },
        keyUp() {
            if(this.cursor > -1) {
                this.cursor--
                this.itemView(this.$el.getElementsByClassName('v-autocomplete-list-item'))
            }
        },
        keyDown() {
            if(this.cursor < this.internalItems.length) {
                this.cursor++
                this.itemView(this.$el.getElementsByClassName('v-autocomplete-list-item'))
            }
        },
        itemView(item) {
            if(item && item.scrollIntoView) {
                item.scrollIntoView(false)
            }
        },
        keyEnter(e) {
            e.preventDefault()
            if(this.showList && this.internalItems[this.cursor]) {
                this.onSelectItem(this.internalItems[this.cursor])
                this.showList = false
            }
            else if(this.searchText) {
                this.$router.push(`/Go?q=${encodeURIComponent(this.searchText)}`)
                this.showList = false
            }
        },
        reset() {
            this.searchTextModel = ''
            this.searchText = ''
            this.cursor = -1
            this.items = []
        }
    }
}
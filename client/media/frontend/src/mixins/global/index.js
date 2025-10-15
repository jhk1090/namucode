import FontAwesomeIcon from '@/mixins/global/fontAwesomeIcon'

import Nuxt from '@/components/global/nuxt'
import NuxtLink from '@/components/global/nuxtLink'

export default {
    mixins: [
        FontAwesomeIcon
    ],
    components: {
        RouterView: Nuxt,
        RouterLink: NuxtLink
    },
    computed: {
        page() {
            return this.$store.state.page
        },
        data() {
            return this.$store.state.viewData
        },
        session() {
            return this.$store.state.session
        }
    }
}
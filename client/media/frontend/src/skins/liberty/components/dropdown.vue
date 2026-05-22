<template>
    <div ref="dropdown" class="dropdown">
        <div @click="toggle"><slot name="toggle"></slot></div>
        <div v-if="show" @click="hide" :class="{ 'open': show }"><slot></slot></div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            show: false,
        }
    },
    methods: {
        toggle() {
            this.show = !this.show;
        },
        hide() {
            this.show = false;
        },
        backdrop(e) {
            if (this.show && !this.$refs.dropdown.contains(e.target)) this.show = false;
        },
    },
    mounted() {
        document.addEventListener('click', this.backdrop);
    },
    beforeUnmount() {
        document.removeEventListener('click', this.backdrop);
    }
}
</script>
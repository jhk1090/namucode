<template>
    <div class="Liberty" :style="skinConfig">
        <div id="top"></div>
        <div class="nav-wrapper" :class="{ 'navbar-fixed-top': false }">
            <nav class="navbar navbar-dark">
                <ul class="nav navbar-nav">
                    <li class="nav-item" @click="openSettingModal">
                        <a class="nav-link"><span class="fa fa-gear"></span><span class="hide-title">설정</span></a>
                    </li>
                    <li class="nav-item" @click="toggleTheme">
                        <a class="nav-link"><span class="fa fa-moon-o"></span><span class="hide-title">테마로 변경</span></a>
                    </li>
                    <li class="nav-item" @click="openReferenced">
                        <a class="nav-link"><span class="fa fa-list"></span><span class="hide-title">참조된 문서 목록</span></a>
                    </li>
                    <li class="nav-item" @click="openIPE">
                        <a class="nav-link"><span class="fa fa-pencil-square-o"></span><span class="hide-title">매개변수 편집기</span></a>
                    </li>
                    <!-- <li class="nav-item">
                        <dropdown>
                            <template #toggle>
                                <a class="nav-link dropdown-toggle dropdown-toggle-fix" href="#" @click.prevent>
                                    <span class="fa fa-gear"></span><span class="hide-title">도구</span>
                                </a>
                            </template>
                            <div class="dropdown-menu" role="menu">
                                <nuxt-link to="/Upload" class="dropdown-item">파일 올리기</nuxt-link>
                                <div class="dropdown-divider"></div>
                                <nuxt-link to="/NeededPages" class="dropdown-item">작성이 필요한 문서</nuxt-link>
                                <nuxt-link to="/OrphanedPages" class="dropdown-item">고립된 문서</nuxt-link>
                                <nuxt-link to="/OrphanedCategories" class="dropdown-item">고립된 분류</nuxt-link>
                                <nuxt-link to="/UncategorizedPages" class="dropdown-item">분류가 되지 않은 문서</nuxt-link>
                                <nuxt-link to="/OldPages" class="dropdown-item">편집된 지 오래된 문서</nuxt-link>
                                <nuxt-link to="/ShortestPages" class="dropdown-item">내용이 짧은 문서</nuxt-link>
                                <nuxt-link to="/LongestPages" class="dropdown-item">내용이 긴 문서</nuxt-link>
                                <nuxt-link to="/BlockHistory" class="dropdown-item">차단 내역</nuxt-link>
                                <nuxt-link to="/RandomPage" class="dropdown-item">RandomPage</nuxt-link>
                                <nuxt-link to="/License" class="dropdown-item">라이선스</nuxt-link>
                                <template v-if="$store.state.session.menus.length">
                                    <div class="dropdown-divider"></div>
                                    <nuxt-link v-for="m in $store.state.session.menus" :key="m.l" :to="m.l" class="dropdown-item">{{ m.t }}</nuxt-link>
                                </template>
                            </div>
                        </dropdown>
                    </li> -->
                </ul>
                <div class="navbar-login">
                    <!-- <dropdown class="login-menu">
                        <template #toggle>
                            <a id="login-menu" class="dropdown-toggle" type="button">
                                <img v-if="$store.state.session.gravatar_url" class="profile-img" :src="$store.state.session.gravatar_url">
                                <span v-else class="fa fa-user"></span>
                            </a>
                        </template>
                        <div class="dropdown-menu dropdown-menu-right login-dropdown-menu">
                            <div v-if="$store.state.session.account.type === 1" class="username dropdown-item">
                                <b>{{ $store.state.session.account.name }}</b><br>Member
                            </div>
                            <div v-else-if="$store.state.session.account.type === 0" class="username dropdown-item">
                                <b>{{ $store.state.session.account.name }}</b><br>Please login!
                            </div>
                            <div class="dropdown-divider"></div>
                            <a href="#" class="dropdown-item" @click.prevent="openSettingModal">설정</a>
                            <a v-if="$store.state.currentTheme === 'light'" href="#" class="dropdown-item" @click.prevent="$store.commit('localConfigSetValue', {key: 'wiki.theme', value: 'dark'})">다크 테마로</a>
                            <a v-if="$store.state.currentTheme === 'dark'" href="#" class="dropdown-item" @click.prevent="$store.commit('localConfigSetValue', {key: 'wiki.theme', value: 'light'})">라이트 테마로</a>
                            <div class="dropdown-divider"></div>
                            <template v-if="$store.state.session.account.type === 1">
                                <nuxt-link to="/member/mypage" class="dropdown-item">내 정보</nuxt-link>
                                <nuxt-link :to="doc_action_link(user_doc($store.state.session.account.name), 'w')" class="dropdown-item">내 사용자 문서</nuxt-link>
                                <nuxt-link to="/member/starred_documents" class="dropdown-item">내 문서함</nuxt-link>
                                <div class="dropdown-divider"></div>
                            </template>
                            <template v-if="$store.state.session.account.uuid">
                                <nuxt-link class="dropdown-item" :to="contribution_link($store.state.session.account.uuid)">내 문서 기여 목록</nuxt-link>
                                <nuxt-link class="dropdown-item" :to="contribution_link_discuss($store.state.session.account.uuid)">내 토론 기여 목록</nuxt-link>
                                <nuxt-link class="dropdown-item" :to="contribution_link_edit_request($store.state.session.account.uuid)">내 편집 요청 목록</nuxt-link>
                                <div class="dropdown-divider"></div>
                            </template>
                            <nuxt-link v-if="$store.state.session.account.type === 1" :to="{path:'/member/logout',query:{redirect:$route.fullPath}}" class="dropdown-item">로그아웃</nuxt-link>
                            <nuxt-link v-else :to="{path:'/member/login',query:{redirect:$route.fullPath}}" class="dropdown-item">로그인</nuxt-link>
                        </div>
                    </dropdown> -->
                </div>
            </nav>
        </div>
        <div class="content-wrapper">
            <div class="container-fluid liberty-content">
                <div class="liberty-content-header">
                    <div class="title">
                        <h1>{{ store.localConfig["page.title"] }}</h1>
                    </div>
                </div>
                <div class="liberty-content-main wiki-article">
                    <Wiki />
                    <div class="clearfix"></div>
                </div>
                <div id="bottom" class="liberty-footer"></div>
            </div>
        </div>
        <div class="scroll-buttons">
            <a class="scroll-toc" href="#toc"><i class="fa fa-list-alt" aria-hidden="true"></i></a>
            <a id="left" class="scroll-button" href="#top"><i class="fa fa-arrow-up" aria-hidden="true"></i></a>
            <a id="right" class="scroll-bottom" href="#bottom"><i class="fa fa-arrow-down" aria-hidden="true"></i></a>
        </div>
    </div>
</template>

<style>
@import "./css/bootstrap.min.css";
@import "./css/font-awesome.min.css";
@import "./css/default.css";
@import './css/default_mobile.css';
@import "./css/dark.css";
</style>

<script>
import Common from '@/mixins/common';
import { store } from '@/store.js'
import Wiki from '@/views/wiki.vue';
import Dropdown from './components/dropdown';
import SettingModal from "@/components/setting";
import Referenced from '@/components/referenced.vue';
import IPE from '@/components/IPE.vue';

export default {
    inject: ["triggerHandleMessage"],
    mixins: [Common],
    components: {
        Wiki,
        Dropdown
    },
    data() {
        return {
            store
        }
    },
    head() {
        return {
            meta: [{ name: 'theme-color', content: this.brand_color }]
        };
    },
    computed: {
        brand_color() {
            return this.selectByTheme(store.localConfig['skin.liberty.brand_color_1'] ?? '#4188f1', '#2d2f34');
        },
        skinConfig() {
            return {
                '--liberty-brand-color': this.brand_color,
                '--liberty-brand-dark-color': this.selectByTheme(store.localConfig['skin.liberty.brand_dark_color_1'] ?? this.darkenColor(this.brand_color), '#16171a'),
                '--liberty-brand-bright-color': this.selectByTheme(store.localConfig['skin.liberty.brand_bright_color_1'] ?? this.lightenColor(this.brand_color), '#383b40'),
                '--liberty-navbar-logo-image': store.localConfig['skin.liberty.navbar_logo_image'] || (store.localConfig['wiki.logo_url'] && `url(${store.localConfig['wiki.logo_url']})`),
                '--liberty-navbar-logo-minimum-width': store.localConfig['skin.liberty.navbar_logo_minimum_width'],
                '--liberty-navbar-logo-width': store.localConfig['skin.liberty.navbar_logo_width'],
                '--liberty-navbar-logo-size': store.localConfig['skin.liberty.navbar_logo_size'],
                '--liberty-navbar-logo-padding': store.localConfig['skin.liberty.navbar_logo_padding'],
                '--liberty-navbar-logo-margin': store.localConfig['skin.liberty.navbar_logo_margin'],
                '--brand-color-1': 'var(--liberty-brand-color)',
                '--brand-color-2': this.selectByTheme(store.localConfig['skin.liberty.brand_color_2'] ?? 'var(--liberty-brand-color)', 'var(--liberty-brand-color)'),
                '--brand-bright-color-1': 'var(--liberty-brand-bright-color)',
                '--brand-bright-color-2': this.selectByTheme(store.localConfig['skin.liberty.brand_bright_color_2'] ?? 'var(--liberty-brand-bright-color)', 'var(--liberty-brand-bright-color)'),
                '--text-color': this.selectByTheme('#373a3c', '#ddd'),
                '--article-background-color': this.selectByTheme('#fff', '#000'),
            };
        },
    },
    methods: {
        darkenColor(hex, percent=50) {
            let r = parseInt(hex.substring(1, 3), 16);
            let g = parseInt(hex.substring(3, 5), 16);
            let b = parseInt(hex.substring(5, 7), 16);

            r = Math.round(r * (1 - percent / 100));
            g = Math.round(g * (1 - percent / 100));
            b = Math.round(b * (1 - percent / 100));

            return "#" + ((r < 16 ? "0" : "") + r.toString(16)) + ((g < 16 ? "0" : "") + g.toString(16)) + ((b < 16 ? "0" : "") + b.toString(16));
        },
        lightenColor(hex, percent=50) {
            let r = parseInt(hex.substring(1, 3), 16);
            let g = parseInt(hex.substring(3, 5), 16);
            let b = parseInt(hex.substring(5, 7), 16);

            r = Math.round(r + (255 - r) * (percent / 100));
            g = Math.round(g + (255 - g) * (percent / 100));
            b = Math.round(b + (255 - b) * (percent / 100));

            return "#" + ((r < 16 ? "0" : "") + r.toString(16)) + ((g < 16 ? "0" : "") + g.toString(16)) + ((b < 16 ? "0" : "") + b.toString(16));
        },
        selectByTheme(light, dark) {
            return store.localConfig["wiki.calculatedTheme"] === 'dark' ? dark : light;
        },
        openSettingModal() {
            this.$vfm.show({ component: SettingModal });
        },
        openReferenced() {
            this.$vfm.show({ component: Referenced, bind: { referencedList: store.localConfig["page.referenced"] } });
        },
        openIPE() {
            this.$vfm.show({ component: IPE, bind: { parameterMap: store.localConfig["page.parameterMap"] ?? {} } });
        },
        toggleTheme() {
            this.triggerHandleMessage({
                data: {
                    type: "updateTheme",
                    themeKind: store.localConfig["wiki.calculatedTheme"] === "light" ? "dark" : "light"
                }
            })
        }
    }
}
</script>

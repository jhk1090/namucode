import { decode } from '@msgpack/msgpack';
import fs from 'fs'

export default {
    methods: {
        doc_fulltitle(document) {
            const type = typeof document;

            if(type === 'object') {
                if(document.forceShowNamespace === false) return document.title;
                return `${document.namespace}:${document.title}`;
            }
            else return document;
        },
        user_doc(str) {
            return `사용자:${str}`;
        },
        contribution_link(uuid) {
            return `/contribution/${uuid}/document`;
        },
        contribution_link_discuss(uuid) {
            return `/contribution/${uuid}/discuss`;
        },
        contribution_link_edit_request(uuid) {
            return `/contribution/${uuid}/edit_request`;
        },
        contribution_link_accepted_edit_request(uuid) {
            return `/contribution/${uuid}/accepted_edit_request`
        },
        encodeSpecialChars(str, exclude = []) {
            if(!str) return str;

            const specialChars = '?&=+$#%'.split('');
            return str.split('').map(a => specialChars.includes(a) && !exclude.includes(a) ? encodeURIComponent(a) : a).join('');
        },
        doc_action_link(document, route, query = {}) {
            const specialUrls = [
                '.',
                '..',
                '\\'
            ];

            const title = typeof document === 'string' ? document : this.doc_fulltitle(document);
            let str;
            if(specialUrls.includes(title) || route.startsWith('a/')) {
                query.doc = encodeURIComponent(title);
                str = `/${route}/`;
            }
            else str = `/${route}/${this.encodeSpecialChars(title)}`;
            if(Object.keys(query).length > 0) {
                str += '?';
                str += Object.keys(query).filter(k => query[k]).map(k => `${k}=${query[k]}`).join('&');
            }
            return str;
        },
        getTitleDescription(page) {
            const text = {
                edit_edit_request: '편집 요청',
                edit_request: '편집 요청',
                edit: '편집',
                history: '역사',
                backlinks: '역링크',
                move: '이동',
                delete: '삭제',
                acl: 'ACL',
                thread: '토론',
                thread_list: '토론 목록',
                thread_list_close: '닫힌 토론',
                edit_request_close: '닫힌 편집 요청',
                diff: '비교',
                revert: `r${page.data.rev}로 되돌리기`,
                raw: `r${page.data.rev} RAW`,
                blame: `r${page.data.rev} Blame`,
                wiki: page.data.rev ? `r${page.data.rev}` : '',
            }[page.viewName];

            let additionalText;
            if(page.data.thread) additionalText = page.data.thread.topic;

            return text ? ` (${text})` + (additionalText ? ` - ${additionalText}` : '') : '';
        },
        removeHtmlTags(text) {
            return text.replaceAll(/<[^>]+>/g, '');
        },
        durationToExactString(duration) {
            const strs = [];

            let weeks = 0;
            const week = 1000 * 60 * 60 * 24 * 7;
            while(duration >= week) {
                duration -= week;
                weeks++;
            }
            if(weeks) strs.push(`${weeks}주`);

            let days = 0;
            const day = 1000 * 60 * 60 * 24;
            while(duration >= day) {
                duration -= day;
                days++;
            }
            if(days) strs.push(`${days}일`);

            let hours = 0;
            const hour = 1000 * 60 * 60;
            while(duration >= hour) {
                duration -= hour;
                hours++;
            }
            if(hours) strs.push(`${hours}시간`);

            let minutes = 0;
            const minute = 1000 * 60;
            while(duration >= minute) {
                duration -= minute;
                minutes++;
            }
            if(minutes) strs.push(`${minutes}분`);

            let seconds = 0;
            const second = 1000;
            while(duration >= second) {
                duration -= second;
                seconds++;
            }
            if(seconds) strs.push(`${seconds}초`);

            return strs.join(' ');
        },
        async internalRequest(url, options) {
            const noProgress = options?.noProgress ?? false
            delete options?.noProgress

            const mainView = this.$store.state.components.mainView
            const progressBar = noProgress ? null : mainView.$refs.progressBar
            progressBar?.start()

            const userUrl = options?.userUrl
            delete options?.userUrl

            // let res1 = await fetch("http://127.0.0.1:5500/client/media/output.html", {
            //     ...options,
            //     headers: {
            //         ...(options?.headers || {}),
            //         'X-Chika': import.meta.env.DEV ? 'bypass' : __THETREE_VERSION_HEADER__,
            //         'X-Riko': this.$store.state.sessionHash,
            //         'X-You': this.$store.state.configHash
            //     }
            // })
            // const res = new Response('<div>200</div>', {
            // status: 200,
            // statusText: 'OK',
            // headers: {
            //     'Content-Type': 'text/html; charset=utf-8',
            // },
            // });
            const res = await fetch(typeof url === 'string' ? '/internal' + url : url, {
                ...options,
                headers: {
                    ...(options?.headers || {}),
                    'X-Chika': import.meta.env.DEV ? 'bypass' : __THETREE_VERSION_HEADER__,
                    'X-Riko': this.$store.state.sessionHash,
                    'X-You': this.$store.state.configHash
                }
            })

            if(res.status !== 200) {
                if(!this.$store.state.page.contentHtml && !this.$store.state.viewData.viewComponent) {
                    this.$store.state.page.title = '오류'
                    this.$store.state.page.contentHtml = `API 요청 실패: ${res.status}`
                    await this.$store.state.updateView()
                }
                else {
                    if(userUrl) location.href = userUrl
                    else location.reload()
                }
                progressBar?.finish()
                return
            }

            const buffer = await res.arrayBuffer()
            let json = decode(buffer)
            json = this.afterInternalRequest(json, progressBar)

            return this.withoutKeys(json, [
                'config',
                'configHash',
                'session',
                'sessionHash',
                'partialData',
                'url'
            ])
        },
        afterInternalRequest(json, progressBar) {
            if(import.meta.env.DEV && !import.meta.env.SSR) console.log(json)

            if(json.config) {
                this.$store.state.$patch(state => {
                    state.config = json.config
                    state.configHash = json.configHash
                })
            }
            if(json.session) {
                this.$store.state.$patch(state => {
                    state.session = json.session
                    state.sessionHash = json.sessionHash
                })
            }
            if(json.partialData)
                this.$store.state.patchPartialPageData(json.partialData)

            const strCode = json.code?.toString() || ''
            if(strCode.startsWith('3')) {
                this.$store.state.components.mainView.nextUrl = json.url
                return
            }

            if(!json.page?.contentName) progressBar?.finish()

            return json
        },
        async processInternalResponse(json, form) {
            if(!json) {
                this.$store.state.components.mainView.processNextUrl()
                return
            }
            const statePatches = this.$store.state.parseResponse(json)

            if(json.page) {
                await this.$store.state.updateView(statePatches)
            }

            if(json.data) {
                this.$store.state.clearFormErrors()

                if(typeof json.data === 'string') {
                    this.$store.state.viewData.errorAlert = json.data

                    const firstInput = form?.querySelector('input, select, textarea')
                    if(firstInput) this.$nextTick().then(() => firstInput.focus())

                    this.$store.state.viewData.errorAlertExists = false
                    await this.$nextTick()
                    const alertExists = this.$store.state.viewData.errorAlertExists
                    if(!alertExists)
                        alert(json.data)
                }
                else {
                    const fieldErrors = json.data.fieldErrors
                    this.$store.state.viewData.fieldErrors = fieldErrors
                    if(fieldErrors) {
                        const firstInputName = Object.keys(json.data.fieldErrors)[0]
                        const firstInput = form?.querySelector(`[name="${firstInputName}"]`)
                        await this.$nextTick()
                        firstInput?.focus()
                    }
                }
            }

            if(json.action) switch(json.action) {
                case 'reloadView':
                    await this.$store.state.components.mainView.loadView()
                    break
            }
        },
        async internalRequestAndProcess(url, options) {
            const res = await this.internalRequest(url, options)
            await this.processInternalResponse(res)
            return res
        },
        onDynamicContentClick(e) {
            if(e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return

            const container = this.$refs.div
            let link = null
            for(let el = e.target; el && el !== container; el = el.parentNode) {
                if(el.tagName === 'BUTTON') return
                if(el.tagName === 'A') {
                    link = el
                    break
                }
            }
            if(!link || link.getAttribute('target')) return

            const href = link.getAttribute('href')
            if(href
                && !(href.startsWith('//') || href.startsWith("http://") || href.startsWith("https://"))) {
                e.preventDefault()

                let path = href
                if(href.startsWith('#')) {
                    const fullPath = this.$route.fullPath
                    const hashIndex = fullPath.lastIndexOf('#')
                    const basePath = hashIndex === -1
                        ? fullPath
                        : fullPath.slice(0, hashIndex)
                    path = basePath + href
                }

                this.$router.push(path)
            }
        },
        camelToSnakeCase(str) {
            return str.replace(/(.)([A-Z][a-z]+)/, '$1_$2').replace(/([a-z0-9])([A-Z])/, '$1_$2').toLowerCase();
        },
        snakeToCamelCase(str) {
            return str.toLowerCase().replace(/(?:^|_)(\w)/g, (_, c) => c.toUpperCase());
        },
        async waitUntil(promise, timeout = -1) {
            let resolved = false;

            return new Promise((resolve, reject) => {
                let timeoutId;
                if(timeout >= 0) {
                    timeoutId = setTimeout(() => {
                        resolve('timeout');
                        resolved = true;
                    }, timeout);
                }

                promise.then(result => {
                    if(resolved) return;

                    if(timeoutId) clearTimeout(timeoutId);
                    resolve(result);
                }).catch(error => {
                    if(resolved) return;

                    if(timeoutId) clearTimeout(timeoutId);
                    reject(error);
                });
            });
        },
        withoutKeys(obj, keys = []) {
            if(!obj) return obj;
            if(Array.isArray(obj)) return obj.map(a => this.withoutKeys(a, keys));
            obj = JSON.parse(JSON.stringify(obj));
            return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
        }
    }
}
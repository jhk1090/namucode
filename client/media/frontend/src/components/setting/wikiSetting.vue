<template>
  <SettingItemSelect label="테마" ckey="wiki.theme" default="auto" @change="changeTheme">
    <option value="auto">자동 (시스템 설정)</option>
    <option value="light">라이트</option>
    <option value="dark">다크</option>
  </SettingItemSelect>
  <SettingItemCheckbox label="내용과 링크가 다른 링크 펼치기" ckey="wiki.unfold_wiki_link" />
  <SettingItemCheckbox label="표 워드랩 사용 안 함" ckey="wiki.nowrap_wiki_table" />
  <SettingItemCheckbox label="문단을 기본으로 접기" ckey="wiki.hide_heading_content" @change="refreshContent" />
  <SettingItemCheckbox label="접기 문법을 기본으로 펼치기" ckey="wiki.show_folding" @change="refreshContent" />
  <SettingItemCheckbox label="접기 문법의 애니메이션 비활성" ckey="wiki.disable_folding_animation" @change="refreshContent" />
  <SettingItemSelect label="취소선" ckey="wiki.strike" default="show">
    <option value="show">보이기</option>
    <option value="remove">취소선 제거</option>
    <option value="hide">숨기기</option>
  </SettingItemSelect>
  <SettingItemSelect label="파일" ckey="wiki.image_hide" default="show" @change="refreshContent">
    <option value="show">보이기</option>
    <option value="hide">숨기기</option>
    <option value="hide_1mb">1MB 이상 파일 숨기기</option>
  </SettingItemSelect>
  <SettingItemCheckbox label="파일 lazy load 비활성화" ckey="wiki.disable_image_lazy" @change="refreshContent" />
  <SettingItemSelect label="분류 위치" ckey="wiki.category_position" default="top">
    <option value="top">상단</option>
    <option value="bottom">하단</option>
    <option value="both">모두</option>
  </SettingItemSelect>
</template>
<script>
import Common from '@/mixins/common'
import SettingItemCheckbox from '@/components/settingItemCheckbox'
import SettingItemSelect from '@/components/settingItemSelect'

export default {
  mixins: [Common],
  components: {
    SettingItemCheckbox,
    SettingItemSelect
  },
  inject: ["triggerHandleMessage"],
  methods: {
    changeTheme(e) {
      const selectedValue = e.target ? e.target.value : e;
      
      this.triggerHandleMessage({
        data: {
          type: 'updateTheme',
          themeKind: selectedValue
        }
      }); 
    },
    refreshContent(e) {
      this.triggerHandleMessage({
        data: {
          type: 'updateContent',
          newKey: Date.now()
        }
      })
    }
  }
}
</script>
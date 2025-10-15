<template>
  <Modal @beforeOpen="beforeOpen" v-slot="props">
    <SeedForm :afterSubmit="afterSubmit" method="post" action="/aclgroup">
      <h4>빠른 ACLGroup</h4>
      <FormErrorAlert/>
      <div>
        <p>그룹:</p>
        <select v-if="groups.length" name="group">
          <option v-for="item in groups" :value="item.uuid">{{item.name}}</option>
        </select>
        <Loading v-else/>
        <ShowError tag="group"/>
      </div>
      <div>
        <p>대상:</p>
        <select name="mode" v-model="mode">
          <option value="ip">아이피</option>
          <option value="username">사용자 이름</option>
        </select>
        <ShowError tag="mode"/>
        <input v-if="mode === 'ip'" type="text" name="ip" v-model="ip">
        <input v-else type="text" name="username" v-model="username">
        <ShowError :tag="mode"/>
      </div>
      <div>
        <p>사유:</p>
        <input type="text" name="note" v-model="note">
        <ShowError tag="note"/>
      </div>
      <div>
        <p>차단 기간:</p>
        <DurationSelector name="duration"/>
        <ShowError tag="duration"/>
      </div>
      <div class="button-block">
        <SeedButton large danger>추가</SeedButton>
        <SeedButton type="button" large @click="props.close">취소</SeedButton>
      </div>
    </SeedForm>
  </Modal>
</template>
<script>
import Common from '@/mixins/common'
import SeedForm from '@/components/form/seedForm'
import ShowError from '@/components/showError'
import Loading from '@/components/loading'
import DurationSelector from '@/components/durationSelector'
import SeedButton from '@/components/seedButton'
import FormErrorAlert from '@/components/form/formErrorAlert'
import Modal from '@/components/modal'

export default {
  mixins: [Common],
  components: {
    Modal,
    FormErrorAlert,
    SeedButton,
    DurationSelector,
    Loading,
    ShowError,
    SeedForm
  },
  data() {
    return {
      groups: [],

      mode: 'ip',
      ip: '',
      username: '',
      note: ''
    }
  },
  methods: {
    beforeOpen(e) {
      this.loadACLGroups()

      const params = e.ref.params._rawValue
      this.mode = params.ip ? 'ip' : 'username'
      this.ip = params.ip
      this.username = params.username
      this.note = params.note
    },
    async loadACLGroups() {
      const res = await this.internalRequest('/aclgroup/groups', {
        noProgress: true
      })
      this.groups = Object.values(res)
    },
    afterSubmit() {
      this.$vfm.hideAll()
    }
  }
}
</script>
<style scoped>
input, select {
  background-color: #fff;
  background-image: none;
  border: .0625rem solid #ccc;
  border-radius: 0;
  color: #55595c;
  display: inline-block;
  font-size: .9rem;
  line-height: 1.5;
  margin: 0 0 0 .7rem;
  padding: .25rem .5rem;
}

.theseed-dark-mode input {
  background-color: #27292d;
  border-color: #383b40;
  color: #ddd;
}

.theseed-dark-mode form {
  color: #fff;
}

form {
  box-sizing: border-box;
  flex: 1 0 auto;
  font-size: 14px;
  padding: 15px;
  width: 100%;
}

form div p {
  margin-bottom: 0;
}

form h4 {
  font-weight: 600;
  margin: 0;
  padding: 0;
}

form input[type=text], form select {
  margin: 0;
  width: 100%;
}

form div.button-block {
  float: right;
  margin-bottom: 1rem;
  margin-top: 1rem;
}
</style>
const vscode = acquireVsCodeApi();
const textarea = document.getElementById("input");
const button = document.getElementById("apply");
const reset = document.getElementById("reset");
const error = document.getElementById("error");

const isValid = (content) => {
  if (content === "") return true;
  const fullRe = /^(?:(?:\\\\.|[^=,\\\\])+=(?:\\\\.|[^,\\\\])*)(?:,(?:\\\\.|[^=,\\\\])+=(?:\\\\.|[^,\\\\])*)*$/;
  return fullRe.test(content);
};

const parseParams = (content) => {
  content = content.replaceAll("\\n", "");
  content = content.replaceAll("\\t", "");

  // 전체 형식 검증 (선택적)
  const fullRe = /^(?:(?:\\\\.|[^=,\\\\])+=(?:\\\\.|[^,\\\\])*)(?:,(?:\\\\.|[^=,\\\\])+=(?:\\\\.|[^,\\\\])*)*$/;
  if (!fullRe.test(content)) {
    throw new Error("Invalid format");
  }

  const pairRe = /((?:\\\\.|[^=,\\\\])+)=((?:\\\\.|[^,\\\\])*)/g;

  const result = {};
  let m;
  while ((m = pairRe.exec(content)) !== null) {
    const rawKey = m[1];
    const rawVal = m[2];
    const key = rawKey.trim();
    const val = rawVal.trim();
    result[key] = val;
  }
  return result;
};

// 이전 상태 복원
const state = vscode.getState();
if (state?.text) textarea.value = state.text;

function autoResize() {
  textarea.style.height = "auto"; // 높이 초기화
  textarea.style.height = textarea.scrollHeight + "px"; // scrollHeight만큼 늘리기
}

// 입력값이 바뀔 때마다 저장
textarea.addEventListener("input", () => {
  if (isValid(textarea.value)) {
    error.style.display = "none";
    textarea.style.borderColor = "transparent";
  } else {
    error.style.display = "block";
    textarea.style.borderColor = "red";
  }

  vscode.setState({ text: textarea.value });
  autoResize();
});

button.addEventListener("click", () => {
  try {
    const data = textarea.value.trim() === "" ? "{}" : JSON.stringify(parseParams(textarea.value));
    error.style.display = "none";
    textarea.style.borderColor = "transparent";

    vscode.postMessage({ type: "update", data });
  } catch (e) {
    error.style.display = "block";
    textarea.style.borderColor = "red";
  }
});

reset.addEventListener("click", () => {
  textarea.value = "";
  vscode.setState({ text: textarea.value });
  button.click();
});

window.addEventListener("message", (event) => {
  const message = event.data;
  textarea.value = message;
  vscode.setState({ text: textarea.value });
});

autoResize();

interface ConfigRule {
    linkPattern: string;
    linkPatternFlags: string;
    linkTarget: string;
    languages: string[];
}
interface Config {
  rules: Partial<ConfigRule>[];
}

export const EXTENSION_NAME = "namulink";

export function getConfig(): Config {
  const config: Config = {
    rules: [
      // FIXME: def all link patterns
      // FIXME: 겹친 링크도 정상적으로 연결되도록 regex 다듬기
      {
        linkPattern:
          "\\[\\[(?!http:\\/\\/)(?!https:\\/\\/)([^:].*?)(\\|.*?\\]\\]|\\]\\])", // [[링크]] 및 [[링크|내용]]
        linkTarget: "https://namu.wiki/w/$1",
      },
      {
        linkPattern: "\\[include\\(([^,\\)\\]]*)(?:,[^\\)]*)?\\)\\]", // [include(이름)]
        linkTarget: "https://namu.wiki/w/$1",
      },
      {
        linkPattern: "\\[\\[:(.*?)(\\|.*?\\]\\]|\\]\\])", // [[:링크]] 및 [[:링크|내용]]
        linkTarget: "https://namu.wiki/w/$1",
      },
      {
        linkPattern: "\\[(?:youtube)\\((.[^\\)\\]]*)\\)\\]", // [youtube(링크)]
        linkTarget: "https://youtube.com/watch?v=$1",
      },
      {
        linkPattern: "\\[(?:kakaotv)\\((.[^\\)\\]]*)\\)\\]", // [kakaotv(링크)]
        linkTarget: "https://tv.kakao.com/v/$1",
      },
      {
        linkPattern: "\\[(?:nicovideo)\\((.[^\\)\\]]*)\\)\\]", // [nicovideo(링크)]
        linkTarget: "https://www.nicovideo.jp/watch/$1",
      },
      {
        linkPattern: "\\[(?:vimeo)\\((.[^\\)\\]]*)\\)\\]", // [vimeo(링크)]
        linkTarget: "https://vimeo.com/$1",
      },
      {
        linkPattern: "\\[(?:navertv)\\((.[^\\)\\]]*)\\)\\]", // [navertv(링크)]
        linkTarget: "https://tv.naver.com/v/$1",
      },
    ],
  };

  return {
    rules: (config.rules ?? []).flatMap((rule) => {
      let { linkPattern, linkTarget, linkPatternFlags } = rule ?? {};

      return {
        linkPattern,
        linkTarget,
        linkPatternFlags,
        languages: ["namu"],
      };
    }),
  };
}

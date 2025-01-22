import * as vscode from "vscode";
import type { PartialDeep } from "type-fest";

interface Config {
  rules: {
    linkPattern: string;
    linkPatternFlags: string;
    linkTarget: string;
    languages: string[];
  }[];
}

export const EXTENSION_NAME = "namulink";

export function getConfig(): Config {
  const config: PartialDeep<Config> = {
    rules: [
      // FIXME: def all link patterns
      // FIXME: 겹친 링크도 정상적으로 연결되도록 regex 다듬기
      {
        linkPattern:
          "\\[\\[(?!http:\\/\\/)(?!https:\\/\\/)([^:].*?)(\\|.*?\\]\\]|\\]\\])", // [[링크]] 및 [[링크|내용]]
        linkTarget: "https://namu.wiki/w/$1",
      },
      {
        linkPattern: "\\[\\[:(.*?)(\\|.*?\\]\\]|\\]\\])", // [[:링크]] 및 [[:링크|내용]]
        linkTarget: "https://namu.wiki/w/$1",
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

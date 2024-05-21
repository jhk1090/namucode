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
      {
        linkPattern: "\\[\\[(.*?)\\]\\]",
        linkTarget: "https://namu.wiki/w/$0",
      },
      {
        linkPattern: "\\[\\[(.*?)\\]\\]",
        linkTarget: "https://namu.wiki/w/$0",
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

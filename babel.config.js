
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          extensions: [
            ".ios.ts",
            ".android.ts",
            ".ts",
            ".ios.tsx",
            ".android.tsx",
            ".tsx",
            ".jsx",
            ".js",
            ".json",
          ],
          alias: {
            "@": "./",
            "@components": "./components",
            "@hooks": "./hooks",
            "@types": "./types",
            "@contexts": "./contexts",
            "@utils": "./utils",
            "@styles": "./styles"
          },
        },
      ],
      "@babel/plugin-proposal-export-namespace-from",
      "react-native-worklets/plugin"
    ],
  };
};

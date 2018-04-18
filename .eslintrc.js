module.exports = {
    extends: "standard",
    rules: {
      "indent": ["error", "tab"],
      "no-tabs": ["off"],
      "keyword-spacing": ["error", {
        "before": true, "after": true, "overrides": {
          "if": { "after": false },
          "for": { "after": false },
          "while": { "after": false },
          "switch": { "after": false },
        }
      }],
      "space-in-parens": ["off"],
      "space-before-function-paren": ["off"],
    }
};

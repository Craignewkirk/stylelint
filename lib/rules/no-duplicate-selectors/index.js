"use strict"

const findAtRuleContext = require("../../utils/findAtRuleContext")
const isKeyframeRule = require("../../utils/isKeyframeRule")
const nodeContextLookup = require("../../utils/nodeContextLookup")
const report = require("../../utils/report")
const ruleMessages = require("../../utils/ruleMessages")
const validateOptions = require("../../utils/validateOptions")
const _ = require("lodash")
const normalizeSelector = require("normalize-selector")
const resolvedNestedSelector = require("postcss-resolve-nested-selector")

const ruleName = "no-duplicate-selectors"

const messages = ruleMessages(ruleName, {
  rejected: selector => `Unexpected duplicate selector "${selector}"`,
})

const rule = function (actual) {
  return (root, result) => {
    const validOptions = validateOptions(result, ruleName, { actual })
    if (!validOptions) {
      return
    }

    // The top level of this map will be rule sources.
    // Each source maps to another map, which maps rule parents to a set of selectors.
    // This ensures that selectors are only checked against selectors
    // from other rules that share the same parent and the same source.
    const selectorContextLookup = nodeContextLookup()

    root.walkRules(rule => {
      if (isKeyframeRule(rule)) {
        return
      }

      const contextSelectorSet = selectorContextLookup.getContext(rule, findAtRuleContext(rule))
      const resolvedSelectors = rule.selectors.reduce((result, selector) => {
        return _.union(result, resolvedNestedSelector(selector, rule))
      }, [])
      const normalizedSelectorList = resolvedSelectors.map(normalizeSelector)

      // Complain if the same selector list occurs twice

      // Sort the selectors list so that the order of the constituents
      // doesn't matter
      const sortedSelectorList = normalizedSelectorList.slice().sort().join(",")
      if (contextSelectorSet.has(sortedSelectorList)) {
        // If the selector isn't nested we can use its raw value; otherwise,
        // we have to approximate something for the message -- which is close enough
        const isNestedSelector = resolvedSelectors.join(",") !== rule.selectors.join(",")
        const selectorForMessage = isNestedSelector ? resolvedSelectors.join(", ") : rule.selector
        return report({
          result,
          ruleName,
          node: rule,
          message: messages.rejected(selectorForMessage),
        })
      }

      // We're treating the Map created by nodeContextLookup as a Set
      contextSelectorSet.set(sortedSelectorList, null)

      // Or complain if one selector list contains the same selector more than one
      rule.selectors.forEach((selector, i) => {
        if (_.includes(normalizedSelectorList.slice(0, i), normalizeSelector(selector))) {
          report({
            result,
            ruleName,
            node: rule,
            message: messages.rejected(selector),
          })
        }
      })
    })
  }
}

rule.ruleName = ruleName
rule.messages = messages
module.exports = rule

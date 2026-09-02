import {describe, expect, it} from 'vitest'
import {getIndentCount, isLineStartTagButNotEnd, isTypeScriptLanguage} from '../../src/utils'

describe('client utilities', () => {
	it.each(['typescript', 'typescriptreact'])('accepts %s documents', languageId => {
		expect(isTypeScriptLanguage(languageId)).toBe(true)
	})

	it('rejects unrelated documents', () => {
		expect(isTypeScriptLanguage('javascript')).toBe(false)
	})

	it('recognizes an indented unfinished tag', () => {
		expect(isLineStartTagButNotEnd('\t\t<Component')).toBe(true)
		expect(isLineStartTagButNotEnd('\t\t<Component>')).toBe(false)
		expect(isLineStartTagButNotEnd('<Component')).toBe(false)
	})

	it('counts leading tabs', () => {
		expect(getIndentCount('\t\tvalue')).toBe(2)
		expect(getIndentCount('  value')).toBe(0)
	})
})

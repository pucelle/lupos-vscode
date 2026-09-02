import {describe, expect, it} from 'vitest'
import {JSTokenScanner, ScanState} from '../../src/tokens'

describe('JSTokenScanner', () => {
	it('reports an unfinished template literal', () => {
		let scanner = new JSTokenScanner('const view = html`<div>')
		expect(scanner.scanForFinalState()).toBe(ScanState.WithinTemplateLiteral)
		expect(scanner.startTemplateQuoteOffset).toBe(17)
	})

	it('ignores template-looking text inside strings and comments', () => {
		expect(new JSTokenScanner('const x = "`"').scanForFinalState()).toBe(ScanState.AnyContent)
		expect(new JSTokenScanner('// `').scanForFinalState()).toBe(ScanState.WithinSingleLineComment)
	})

	it('handles bracket nesting in a template interpolation', () => {
		let source = 'html`<div>${fn({value: items[index]})}</div>`'
		expect(new JSTokenScanner(source).scanForFinalState()).toBe(ScanState.AnyContent)
	})
})

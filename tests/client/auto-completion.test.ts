import {afterEach, describe, expect, it} from 'vitest'
import {activate, deactivate} from '../../src/index'
import {autoCompletion} from '../../src/auto-completion'
import {
	MockTextDocument,
	MockTextEditor,
	Position,
	Range,
	Selection,
	fireTextDocumentChange,
	resetVSCodeMock,
	window,
} from './vscode-mock'

const flushAsyncEdits = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(resetVSCodeMock)

describe('client activation', () => {
	it('registers and disposes the document listener', async () => {
		let subscriptions: {dispose(): void}[] = []
		activate({subscriptions} as never)

		let document = new MockTextDocument('const view = html`$')
		window.activeTextEditor = new MockTextEditor(document)
		fireTextDocumentChange({document, contentChanges: [{range: new Range(new Position(0, 18), new Position(0, 18)), rangeLength: 0, rangeOffset: document.text.length - 1, text: '$'}]})
		await flushAsyncEdits()

		expect(document.text).toBe('const view = html`${}')
		expect(subscriptions).toHaveLength(1)
		subscriptions[0].dispose()
		expect(deactivate()).toBeUndefined()
	})
})

describe('autoCompletion', () => {
	it('inserts braces and places the cursor between them', async () => {
		let document = new MockTextDocument('const view = html`<div>$')
		let editor = new MockTextEditor(document)
		window.activeTextEditor = editor

		autoCompletion({document, contentChanges: [{rangeOffset: document.text.length - 1, text: '$'}]} as never)
		await flushAsyncEdits()

		expect(document.text).toBe('const view = html`<div>${}')
		expect(document.offsetAt(editor.selection.active)).toBe(document.text.length - 1)
	})

	it('does nothing outside TypeScript template literals', async () => {
		let document = new MockTextDocument('const value = "$"', 'javascript')
		window.activeTextEditor = new MockTextEditor(document)
		autoCompletion({document, contentChanges: [{rangeOffset: document.text.length - 2, text: '$'}]} as never)
		await flushAsyncEdits()
		expect(document.text).toBe('const value = "$"')
	})

	it('eats the redundant quote when a closing backtick pair is inserted', async () => {
		let sourceBeforeInsert = 'const view = html`<div></div>'
		let document = new MockTextDocument(sourceBeforeInsert + '``')
		let editor = new MockTextEditor(document)
		window.activeTextEditor = editor

		autoCompletion({
			document,
			contentChanges: [{rangeOffset: sourceBeforeInsert.length, text: '``'}],
		} as never)
		await flushAsyncEdits()

		expect(document.text).toBe(sourceBeforeInsert + '`')
		expect(document.offsetAt(editor.selection.active)).toBe(document.text.length)
	})

	it('adds one indentation level after an unfinished tag', async () => {
		let before = 'const view = html`\n\t<Componentvalue`'
		let start = before.indexOf('value')
		let text = before.slice(0, start) + '\n\t' + before.slice(start)
		let document = new MockTextDocument(text)
		let editor = new MockTextEditor(document)
		window.activeTextEditor = editor

		autoCompletion({document, contentChanges: [{rangeOffset: start, text: '\n\t'}]} as never)
		await flushAsyncEdits()

		expect(document.text).toBe('const view = html`\n\t<Component\n\t\tvalue`')
	})

	it('restores tabs eaten when completing a closing HTML tag', async () => {
		let document = new MockTextDocument('const view = html`\n\t\t<a>\n</a>\n`')
		let editor = new MockTextEditor(document)
		editor.selection = new Selection(new Position(2, 4), new Position(2, 4))
		window.activeTextEditor = editor

		autoCompletion({
			document,
			contentChanges: [
				{range: new Range(new Position(2, 4), new Position(2, 4)), rangeLength: 0, rangeOffset: 31, text: '>'},
				{range: new Range(new Position(2, 0), new Position(2, 2)), rangeLength: 2, rangeOffset: 27, text: ''},
			],
		} as never)
		await flushAsyncEdits()

		expect(document.text).toBe('const view = html`\n\t\t<a>\n\t\t</a>\n`')
		expect(editor.selection.active).toEqual(new Position(2, 6))
	})

	it('restores closing-tag indentation when VS Code reports only the typed character', async () => {
		let document = new MockTextDocument('const view = html`\n\t\t<a>\n</a>\n`')
		let editor = new MockTextEditor(document)
		editor.selection = new Selection(new Position(2, 4), new Position(2, 4))
		window.activeTextEditor = editor

		autoCompletion({
			document,
			contentChanges: [{
				range: new Range(new Position(2, 3), new Position(2, 3)),
				rangeLength: 0,
				rangeOffset: 30,
				text: '>',
			}],
		})
		await flushAsyncEdits()

		expect(document.text).toBe('const view = html`\n\t\t<a>\n\t\t</a>\n`')
		expect(editor.selection.active).toEqual(new Position(2, 6))
	})
})

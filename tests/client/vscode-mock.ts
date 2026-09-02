type Listener = (event: TextDocumentChangeEvent) => void

let changeListener: Listener | undefined

export class Position {
	constructor(readonly line: number, readonly character: number) {}

	translate(lineDelta = 0, characterDelta = 0) {
		return new Position(this.line + lineDelta, this.character + characterDelta)
	}
}

export class Range {
	constructor(readonly start: Position, readonly end: Position) {}
}

export class Selection extends Range {
	readonly active = this.end
}

export interface TextDocumentChangeEvent {
	document: MockTextDocument
	contentChanges: {rangeOffset: number, text: string}[]
}

export class MockTextDocument {
	constructor(public text: string, readonly languageId = 'typescript') {}

	getText() {
		return this.text
	}

	positionAt(offset: number) {
		let lines = this.text.slice(0, offset).split('\n')
		return new Position(lines.length - 1, lines.at(-1)!.length)
	}

	offsetAt(position: Position) {
		let lines = this.text.split('\n')
		let offset = 0
		for (let line = 0; line < position.line; line++) {
			offset += lines[line].length + 1
		}
		return offset + position.character
	}

	lineAt(position: Position) {
		return {text: this.text.split('\n')[position.line] ?? ''}
	}
}

export class MockTextEditor {
	selection!: Selection

	constructor(readonly document: MockTextDocument) {}

	async edit(callback: (builder: {insert(position: Position, text: string): void, delete(range: Range): void}) => void) {
		callback({
			insert: (position, text) => {
				let offset = this.document.offsetAt(position)
				this.document.text = this.document.text.slice(0, offset) + text + this.document.text.slice(offset)
			},
			delete: range => {
				let start = this.document.offsetAt(range.start)
				let end = this.document.offsetAt(range.end)
				this.document.text = this.document.text.slice(0, start) + this.document.text.slice(end)
			},
		})
		return true
	}
}

export const window: {activeTextEditor: MockTextEditor | undefined} = {
	activeTextEditor: undefined,
}

export const workspace = {
	onDidChangeTextDocument(listener: Listener) {
		changeListener = listener
		return {dispose() { changeListener = undefined }}
	},
}

export function fireTextDocumentChange(event: TextDocumentChangeEvent) {
	changeListener?.(event)
}

export function resetVSCodeMock() {
	changeListener = undefined
	window.activeTextEditor = undefined
}

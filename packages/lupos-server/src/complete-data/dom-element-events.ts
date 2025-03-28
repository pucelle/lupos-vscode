import {CompletionItem} from './types'


/** From MDN */
export const DOMElementEvents: CompletionItem[] = [
	{
		name: "abort",
		description: "The loading of a resource has been aborted.",
	},
	{
		name: "blur",
		description: "An element has lost focus (does not bubble).",
	},
	{
		name: "canplay",
		description: "The user agent can play the media, but estimates that not enough data has been loaded to play the media up to its end without having to stop for further buffering of content.",
	},
	{
		name: "canplaythrough",
		description: "The user agent can play the media up to its end without having to stop for further buffering of content.",
	},
	{
		name: "change",
		description: "The change event is fired for `<input>`, `<select>`, and `<textarea>` elements when a change to the element's value is committed by the user.",
	},
	{
		name: "click",
		description: "A pointing device button has been pressed and released on an element.",
	},
	{
		name: 'compositionstart',
		description: "When a text composition system such as an input method editor starts a new composition session.",
	},
	{
		name: 'compositionupdate',
		description: "When a new character is received in the context of a text composition session controlled by a text composition system such as an input method editor.",
	},
	{
		name: 'compositionend',
		description: "When a text composition system such as an input method editor completes or cancels the current composition session.",
	},
	{
		name: "contextmenu",
		description: "The right button of the mouse is clicked (before the context menu is displayed).",
	},
	{
		name: "dblclick",
		description: "A pointing device button is clicked twice on an element.",
	},
	{
		name: "drag",
		description: "An element or text selection is being dragged (every 350ms).",
	},
	{
		name: "dragend",
		description: "A drag operation is being ended (by releasing a mouse button or hitting the escape key).",
	},
	{
		name: "dragenter",
		description: "A dragged element or text selection enters a valid drop target.",
	},
	{
		name: "dragleave",
		description: "A dragged element or text selection leaves a valid drop target.",
	},
	{
		name: "dragover",
		description: "An element or text selection is being dragged over a valid drop target (every 350ms).",
	},
	{
		name: "dragstart",
		description: "The user starts dragging an element or text selection.",
	},
	{
		name: "drop",
		description: "An element is dropped on a valid drop target.",
	},
	{
		name: "durationchange",
		description: "The duration attribute has been updated.",
	},
	{
		name: "emptied",
		description: "The media has become empty; for example, this event is sent if the media has already been loaded (or partially loaded), and the load() method is called to reload it.",
	},
	{
		name: "ended",
		description: "Playback has stopped because the end of the media was reached.",
	},
	{
		name: "error",
		description: "A resource failed to load.",
	},
	{
		name: "focus",
		description: "An element has received focus (does not bubble).",
	},
	{
		name: "input",
		description: "The value of an element changes or the content of an element with the attribute contenteditable is modified.",
	},
	{
		name: "invalid",
		description: "A submittable element has been checked and doesn't satisfy its constraints.",
	},
	{
		name: "keydown",
		description: "A key is pressed down.",
	},
	{
		name: "keypress",
		description: "A key is pressed down and that key normally produces a character value (use input instead).",
	},
	{
		name: "keyup",
		description: "A key is released.",
	},
	{
		name: "load",
		description: "A resource and its dependent resources have finished loading.",
	},
	{
		name: "loadeddata",
		description: "The first frame of the media has finished loading.",
	},
	{
		name: "loadedmetadata",
		description: "The metadata has been loaded.",
	},
	{
		name: "loadstart",
		description: "Progress has begun.",
	},
	{
		name: "mousedown",
		description: "A pointing device button (usually a mouse) is pressed on an element.",
	},
	{
		name: "mousemove",
		description: "A pointing device is moved over an element.",
	},
	{
		name: "mouseout",
		description: "A pointing device is moved off the element that has the listener attached or off one of its children.",
	},
	{
		name: "mouseover",
		description: "A pointing device is moved onto the element that has the listener attached or onto one of its children.",
	},
	{
		name: "mouseup",
		description: "A pointing device button is released over an element.",
	},
	{
		name: "wheel",
		description: "When user rotates a wheel button on a pointing device (typically a mouse).",
	},
	{
		name: "pause",
		description: "Playback has been paused.",
	},
	{
		name: "play",
		description: "Playback has begun.",
	},
	{
		name: "playing",
		description: "Playback is ready to start after having been paused or delayed due to lack of data.",
	},
	{
		name: "progress",
		description: "In progress.",
	},
	{
		name: "ratechange",
		description: "The playback rate has changed.",
	},
	{
		name: "reset",
		description: "A form is reset.",
	},
	{
		name: "resize",
		description: "The document view has been resized.",
	},
	{
		name: "readystatechange",
		description: "The readyState attribute of a document has changed.",
	},
	{
		name: "scroll",
		description: "The document view or an element has been scrolled.",
	},
	{
		name: "seeked",
		description: "A seek operation completed.",
	},
	{
		name: "seeking",
		description: "A seek operation began.",
	},
	{
		name: "select",
		description: "Some text is being selected.",
	},
	{
		name: "show",
		description: "A contextmenu event was fired on/bubbled to an element that has a contextmenu attribute",
	},
	{
		name: "stalled",
		description: "The user agent is trying to fetch media data, but data is unexpectedly not forthcoming.",
	},
	{
		name: "submit",
		description: "A form is submitted.",
	},
	{
		name: "suspend",
		description: "Media data loading has been suspended.",
	},
	{
		name: "timeupdate",
		description: "The time indicated by the currentTime attribute has been updated.",
	},
	{
		name: "volumechange",
		description: "The volume has changed.",
	},
	{
		name: "waiting",
		description: "Playback has stopped because of a temporary lack of data.",
	},

	// Lupos transition extending
	{
		name: "transition-enter-started",
		description: "After enter transition bound with ':transition' started."
	},
	{
		name: "transition-enter-ended",
		description: "After enter transition bound with ':transition' ended."
	},
	{
		name: "transition-leave-started",
		description: "After leave transition bound with ':transition' started."
	},
	{
		name: "transition-leave-ended",
		description: "After leave transition bound with ':transition' started."
	},
]
import { initialize } from './adsbycontextcue';

(function (doc, win) {
	const ContextCue = initialize(doc, win);
	if (doc.readyState === 'complete') {
		setTimeout(ContextCue.fetch);
	} else {
		doc.addEventListener('DOMContentLoaded', () => ContextCue.fetch(), false);
		win.addEventListener('load', () => ContextCue.fetch(), false);
	}
	window.addEventListener('contextcue:fetch', function (data) {
		ContextCue.fetch({
			forceFetch: true,
			// @ts-ignore
			refreshExisting: data && data.detail && data.detail.refreshExisting
		});
	});
})(document, window);

import { initialize } from './adsbycontextcue';
import debounce from './utilities/debounce';

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
	window.addEventListener('resize', debounce(() => {
		ContextCue.fetch({
			forceFetch: true
		});
	}, 100));
})(document, window);

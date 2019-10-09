import { AdSlot } from './types/ad-slot';
import { FetchOptions } from './types/fetch-options';

const url = process.env.NODE_ENV === 'production' ? 'https://api.contextcue.com' : 'http://localhost:3000';

export function initialize(doc: Document, win: Window) {
    let initialLoadTriggered = false;
    const warn = console.warn;
    const fetchedSlots: { [key: string]: boolean } = {};

    const ContextCue = {
        selector: 'ins.adsbycontextcue',
        update: (data: AdSlot) => {
            const fetchIdSelector = data.fetchId ? `[data-cc-id="${data.fetchId}"]` : '';
            data.selector = `${ContextCue.selector}[data-cc-slot="${data.id}"]${fetchIdSelector}`;
            const ins = doc.querySelector<HTMLIFrameElement>(data.selector);
            if (ins && ins.parentNode) {
                if (data.html) {
                    const iframe = ContextCue.createFrame(data);
                    ins.innerHTML = '';
                    ins.appendChild(iframe);
                    ins.parentNode.appendChild(ins);
                    ContextCue.load(iframe, data.html);
                    ins.style.display = 'inline-block';
                } else {
                    // Collapse the ad slot if no ad was found
                    ins.style.display = 'none';
                }
            } else {
                warn(`Unable to find slot ${data.id} ${data.fetchId}`);
            }
        },
        load: (iframe: HTMLIFrameElement, html: string) => {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow && iframe.contentWindow.document;

            if (!iframeDoc) {
                return warn('Invalid iframe');
            }

            iframeDoc.open();
            iframeDoc.writeln(`<!DOCTYPE html><html><head><base target="_top"><meta charset="UTF-8"></head><body style="margin:0;padding:0">${html}</body></html>`);
            iframeDoc.close();
        },
        createFrame: (data: AdSlot) => {
            const iframe = doc.createElement('iframe');
            const style = iframe.style;

            // @ts-ignore
            iframe.sandbox = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-scripts';
            iframe.frameBorder = '0';
            iframe.scrolling = 'no';
            iframe.width = String(data.w);
            iframe.height = String(data.h);
            style.border = '';
            style.margin = '0 auto';
            style.overflow = 'hidden';
            style.width = `${data.w}px`;
            style.height = `${data.h}px`;

            return iframe;
        },
        fetch: (options: FetchOptions = {refreshExisting: false}) => {
            const {forceFetch, refreshExisting} = options;
            if (initialLoadTriggered && !forceFetch) {
                return;
            }
            initialLoadTriggered = true;
            const slots = doc.querySelectorAll<HTMLElement>(ContextCue.selector);
            if (slots.length === 0) {
                return warn('No ad slots found');
            }

            const currentDate = new Date();
            const data: { slots: AdSlot[], time: string, dow: number, site: string | null } = {
                slots: [],
                time: `${currentDate.getHours()}:${currentDate.getMinutes()}`,
                dow: currentDate.getDay(),
                site: slots[0].getAttribute('data-cc-site')
            };
            for (let i = 0; i < slots.length; i++) {
                const slot = slots[i];
                const slotId = slot.getAttribute('data-cc-slot');
                if (!slotId || slotId === '') {
                    warn(`data-cc-slot attribute missing`);
                } else {
                    const fetchId = slot.getAttribute('data-cc-id') || undefined;
                    const hasFetched = fetchedSlots[`${slotId}_${fetchId || ''}`];
                    if (refreshExisting || !hasFetched) {
                        data.slots.push({
                            id: slotId,
                            fetchId,
                            w: parseInt(slot.style.width || '') || slot.offsetWidth,
                            h: parseInt(slot.style.height || '') || slot.offsetHeight
                        });
                        fetchedSlots[`${slotId}_${fetchId || ''}`] = true;
                    }
                }
            }
            if (data.slots.length === 0) {
                // no slots to fetch
                return;
            }

            const q = encodeURIComponent(JSON.stringify(data));
            const req = new XMLHttpRequest();
            req.overrideMimeType('text/plain');
            req.open('GET', `${url}/ad-fetch/serve?q=${q}`, true);
            req.setRequestHeader('Content-Type', 'text/plain');
            req.setRequestHeader('If-Unmodified-Since', new Date().getTime().toString());

            req.onload = () => {
                try {
                    const result = JSON.parse(req.responseText) as { data: { slots: AdSlot[] } };
                    if (result && result.data && result.data.slots) {
                        const filled: AdSlot[] = [];
                        const unfilled: AdSlot[] = [];
                        result.data.slots.forEach(slot => {
                            ContextCue.update(slot);
                            if (slot.html) {
                                filled.push(slot);
                            } else {
                                unfilled.push(slot);
                            }
                        });
                        ContextCue.sendEvent({filled, unfilled});
                    } else {
                        ContextCue.handleErrors(data.slots);
                    }
                } catch (e) {
                    ContextCue.handleErrors(data.slots);
                }
            };
            req.send();
            req.onreadystatechange = () => {
                if (req.readyState === req.DONE && req.status !== 200) {
                    ContextCue.handleErrors(data.slots);
                }
            };
        },
        handleErrors(slots: AdSlot[]) {
            slots.forEach(slot => ContextCue.update(slot));
            ContextCue.sendEvent({filled: [], unfilled: slots});
        },
        sendEvent: (detail: object) => {
            const e = doc.createEvent('CustomEvent');
            e.initCustomEvent('contextcue:loaded', true, true, detail);
            win.dispatchEvent(e);
        }
    };

    return ContextCue;
}

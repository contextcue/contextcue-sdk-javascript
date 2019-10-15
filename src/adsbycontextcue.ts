import { AdSlot } from './types/ad-slot';
import { FetchOptions } from './types/fetch-options';
import {calculateAdSize} from './utilities/ad-size';
import {random} from './utilities/random';

const url = process.env.NODE_ENV === 'production' ? 'https://api.contextcue.com' : 'http://localhost:3000';
const DEFAULT_SELECTOR = 'ins.adsbycontextcue';
const DEFAULT_ID_ATTRIBUTE = 'data-cc-slot';
const DEFAULT_FETCH_ATTRIBUTE = 'data-cc-fetchid';

const buildSlotCacheId = (slot: AdSlot) => `${slot.id}_${slot.fetchId}_${slot.w}_${slot.h}`;

let slotCache: { [key: string]: AdSlot } = {};
let currentState: { [key: string]: AdSlot } = {};

export function initialize(doc: Document, win: Window) {
    let initialLoadTriggered = false;
    const warn = console.warn;

    const ContextCue = {
        update: (data: AdSlot) => {
            const stateId = `${data.id}_${data.fetchId}`;
            if (currentState[stateId] && currentState[stateId].redirectURI === data.redirectURI) {
                // Ad didn't change, no need to update it
                return;
            }
            currentState[stateId] = data;
            slotCache[buildSlotCacheId(data)] = data;
            const selector = `${DEFAULT_SELECTOR}[${DEFAULT_ID_ATTRIBUTE}="${data.id}"][${DEFAULT_FETCH_ATTRIBUTE}="${data.fetchId}"]`;
            const ins = doc.querySelector<HTMLIFrameElement>(selector);
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

            iframe.sandbox.add('allow-same-origin', 'allow-popups', 'allow-popups-to-escape-sandbox', 'allow-scripts');
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
        buildSlotsToFetch: () => {
            const slots = doc.querySelectorAll<HTMLElement>(DEFAULT_SELECTOR);
            if (slots.length === 0) {
                warn('No ad slots found');
                return;
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
                const slotId = slot.getAttribute(DEFAULT_ID_ATTRIBUTE);
                if (!slotId || slotId === '') {
                    warn(`${DEFAULT_ID_ATTRIBUTE} attribute missing`);
                } else if (slot.style.display !== 'none') {
                    const adSize = calculateAdSize(slot);
                    if (!adSize) {
                        warn(`No ad size found for slotId: ${slotId}`);
                        break;
                    }
                    let fetchId = slot.getAttribute(DEFAULT_FETCH_ATTRIBUTE);
                    if (!fetchId) {
                        // Setting a fetchId allows multiple of the same slot on the same page (ex. infinite scroll)
                        fetchId = random();
                        slot.setAttribute(DEFAULT_FETCH_ATTRIBUTE, fetchId);
                    }
                    const newSlot = {
                        id: slotId,
                        fetchId,
                        w: adSize.width,
                        h: adSize.height
                    };

                    const slotCacheId = buildSlotCacheId(newSlot);
                    const previousFetch = slotCache[slotCacheId];
                    if (!previousFetch) {
                        data.slots.push(newSlot);
                        slotCache[slotCacheId] = newSlot;
                    } else {
                        ContextCue.update(previousFetch);
                    }
                }
            }

            return data;
        },
        fetch: (options: FetchOptions = {refreshExisting: false}) => {
            const {forceFetch, refreshExisting} = options;
            if (initialLoadTriggered && !forceFetch) {
                return;
            }
            if (refreshExisting) {
                // Clearing the ad cache will force all ads to be refreshed
                slotCache = {};
            }
            initialLoadTriggered = true;

            const data = ContextCue.buildSlotsToFetch();
            if (!data || data.slots.length === 0) {
                // no slots to fetch
                return;
            }

            const q = encodeURIComponent(JSON.stringify(data));
            const req = new XMLHttpRequest();
            req.overrideMimeType('text/plain');
            req.open('GET', `${url}/ad-fetch/serve?q=${q}`, true);
            req.setRequestHeader('Content-Type', 'text/plain');

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

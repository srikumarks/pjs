/**
 * A "model provider" provides an object that exposes two async methods -
 *
 * .llm(system, user) which returns the llm generated text
 *
 * .im(prompt, width, height) which returns the URL of an image generated
 * according to the given prompt.
 *
 * options.model defaults to "gpt-4o-mini"
 */
export function openai_provider(options={},api_key="OPENAI_API_KEY") {
    const isBrowser = (function () { return typeof(window) !== 'undefined'; })();
    if (api_key === "OPENAI_API_KEY") {
        api_key = isBrowser ? document.body.getAttribute("openai-api-key") : null;
    }
    if (!options.model) {
        options.model = (isBrowser && document.body.getAttribute("openai-model-name")) || "gpt-4o-mini";
    }

    // api is either "responses" for text or "images/generations" for
    // image generation.
    //
    // Provide an API key if you're using this feature.
    async function openai_request(api,body) {
        let api_url = "https://api.openai.com/v1/" + api;
        return fetch(api_url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + api_key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    }

    async function llm(system, user, localOptions = options) {
        let response = await openai_request('responses', {
            "model": localOptions.model,
            "input": [
                {
                    "role": "system",
                    "content": system
                },
                {
                    "role": "user",
                    "content": user
                }
            ],
            "stream": false
        });
        if (response.ok) {
            let json = await response.json();
            return json.output[0].content[0].text;
        } else {
            console.log(response);
            throw new Error("LLM failure");
        }
    }

    async function promptImage(prompt, width, height) {
        let response = await openai_request('images/generations', {
            model: "dall-e-2",
            prompt: prompt,
            size: ''+width+'x'+height,
            //style: "natural",
            n: 1
        });
        if (response.ok) {
            return (await response.json()).data[0].url;
        } else {
            throw new Error("Image generation error");
        }
    }


    let api = {};
    api.llm = llm;
    api.im = promptImage;
    return api;
}

async function hash(obj) {
    let json = JSON.stringify(obj);
    let enc = new TextEncoder();
    let bytes = enc.encode(json);
    let digest = await crypto.subtle.digest('SHA-256', bytes);
    let h = new Uint8Array(digest);
    let hashbytes = [];
    for (let i = 0; i < h.length; ++i) {
        hashbytes.push(h[i].toString(16).padStart(2, '0'));
    }
    return hashbytes.join('');
}



async function promptHTML(el, prompt, history, model_provider) {
    let p = {system: prompt.system + "\n\nThe past generation context is given below in the history tag.\n\n<history>\n" + history.join('\n\n') + '\n</history>\n', user: prompt.user}
    let h = 'llm_' + await hash(p);
    let html = '';
    if (globalThis.localStorage) {
        if (h in globalThis.localStorage) {
            html = globalThis.localStorage[h];
        } else {
            html = globalThis.localStorage[h] = await model_provider.llm(p.system, p.user);
        }
    } else {
        html = await model_provider.llm(p.system, p.user);
    }
    history.push(`<gen><input>${p.user}</input>\n<output>${html}\n</output></gen>`);
    el.setAttribute("data-pjsgenhash", h);
    return html;
}

export function pslang(defns, api) {
    const {forth} = api;
    const model_provider = api.model_provider || openai_provider();
    const history = [];

    // gen
    // Depending on the type of the currently selected element,
    // uses the text on the stack top as a prompt to manipulate its
    // contents.
    //
    // Supported elements are -
    // P and DIV - which get filled by HTML generated by the LLM.
    // OL and UL - which get filled by list items generated by the LLM.
    // SECTION - which gets filled with generated header, etc.
    // H1...H6 -  which get filled with an appropriately generated title/sub-title.
    // IMG - which gets replaced with a generated image of the given spec.
    defns.gen = async function (sel, pstack, dstack, defns) {
        let usertext = dstack.car;
        if (typeof(usertext) !== 'string') {
            throw new Error("Expected text description to generate from");
        }
        if (sel.length !== 1) {
            throw new Error("Expecting a single element selection to generate for");
        }
        let el = sel[0];
        switch (el.tagName) {
            case 'P':
            case 'DIV': {
                let prompt = {
                    system: `Write out only the HTML content to suit this ${el.tagName} tag for the purpose described by the user. Do not add Markdown delimiters for raw HTML.`,
                    user: usertext
                };
                el.innerHTML = await promptHTML(el, prompt, history, model_provider);
                break;
            }
            case 'OL':
            case 'UL': {
                let prompt = {
                    system: `Generate a list of items in HTML (using <li>..</li> tags) for this ${el.tagName} tag according to the purpose given by the user.`,
                    user: usertext
                };
                el.innerHTML = await promptHTML(el, prompt, history, model_provider);
                break;
            }
            case 'SECTION': {
                let prompt = {
                    system: `Generate only the contents for a SECTION in HTML according to the user's specification. Only output the HTML content that is to go within a SECTION tag and not use any surrounding text.`,
                    user: usertext
                };
                el.innerHTML = await promptHTML(el, prompt, history, model_provider);
                break;
            }
            case 'H1':
            case 'H2':
            case 'H3':
            case 'H4':
            case 'H5':
            case 'H6': {
                let prompt = {
                    system: `Generate a title suitable for a ${el.tagName} tag according to the user spec. Only generate the contents.`,
                    user: usertext
                };
                el.innerHTML = await promptHTML(el, prompt, history, model_provider);
                break;
            }
            case 'IMG': {
                let width = el.hasAttribute('width') ? +el.getAttribute('width') : 256;
                let height = el.hasAttribute('height') ? +el.getAttribute('height') : 256;
                let aspectRatio = width / height;
                let adjWidth = width, adjHeight = height;
                if (width < height) {
                    adjWidth = Math.max(256, width);
                    adjHeight = Math.round(adjWidth / aspectRatio);
                } else {
                    adjHeight = Math.max(256, height);
                    adjWidth = Math.round(adjHeight * aspectRatio);
                }
                el.setAttribute('alt', usertext);
                let url = await model_provider.im(usertext, adjWidth, adjHeight);
                el.setAttribute('src', url);
                break;
            }
            default:
                throw new Error(`Unsupported tag ${el.tagName}`);
        }
        return forth(sel, pstack, dstack.cdr, defns);
    };
    // {...text...} prompt
    // Includes the given text as instructions without actually doing anything
    // right now. This will get used in subsequent API invocations.
    defns.prompt = function (sel, pstack, dstack, defns) {
        let usertext = dstack.car;
        history.push(`<instructions>\n{usertext}\n</instructions>\n`);
        if (sel.length > 0) {
            if (sel.length !== 1) {
                throw new Error("Expecting single element selection to register a prompt instruction.");
            }
            sel[0].remove();
        }
        return forth(sel, pstack, dstack.cdr, defns);
    };

    return defns;
}

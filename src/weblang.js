
export function pslang(defns, api) {
    let {forth, cons, empty, psProg} = api;

    function sleep(ms) {
        return new Promise(function (resolve, reject) {
            setTimeout(resolve, ms, true);
        });
    }
    function nextFrame() {
        return new Promise(function (resolve, reject) {
            requestAnimationFrame(function (t) {
                resolve(t);
            });
        });
    }
    // <ms> wait
    // waits for given number of milliseconds before continuing.
    defns.wait = async function (sel, pstack, dstack, defns) {
        let ms = dstack.car;
        await sleep(Math.round(ms));
        return forth(sel, pstack, dstack.cdr, defns);
    };
    // frame
    // Continues on the next animation frame.
    defns.frame = async function (sel, pstack, dstack, defns) {
        await nextFrame();
        return forth(sel, pstack, dstack, defns);
    };
    // {css-selector} sel
    // Sets the currrent selection to the set of elements identified
    // by the given css-selector on the stack stop. Sets it up
    // such that when the current code block ends, the previous
    // selection is restored.
    defns.sel = function (sel, pstack, dstack, defns) {
        let selector = dstack.car;
        let context = sel.length > 0 ? sel[0] : document;
        let newsel = [...context.querySelectorAll(selector)];
        let prog = pstack.car;
        pstack = cons(function (ignore_sel, pstack, dstack, defns) {
            return forth(sel, pstack, dstack, defns);
        }, pstack.cdr);
        pstack = cons(prog, pstack);
        return forth(newsel, pstack, dstack.cdr, defns);
    };
    // parent
    // Changes the current selection to the parents of the
    // elements in the current selection.
    defns.parent = function (sel, pstack, dstack, defns) {
        let parents = [];
        for (let el of sel) {
            parents.push(el.parentElement);
        }
        return forth(parents, pstack, dstack, defns);
    };
    // {https://blah.com/bleh} hget
    // Fetches the given URL and places the text or object on the top
    // of the stack.
    defns.hget = async function (sel, pstack, dstack, defns) {
        let url = dstack.car;
        let response = await fetch(url);
        if (response.ok) {
            let ty = response.headers.get('content-type');
            if (ty === 'application/json') {
                return forth(sel, pstack, cons(await response.json(), dstack.cdr), defns);
            } else {
                return forth(sel, pstack, cons(await response.text(), dstack.cdr), defns);
            }
        } else {
            return forth(sel, pstack, cons(response, dstack.cdr), defns);
        }
    };
    // {<b> hello world </b>} <=>
    // Sets the innerHTML of the current selection to the given string on the
    // stack top.
    defns['<=>'] = function (sel, pstack, dstack, defns) {
        let html = dstack.car;
        for (let el of sel) {
            el.innerHTML = html;
        }
        return forth(sel, pstack, dstack.cdr, defns);
    };
    // {https://blah.com/bleh.pjs} fs
    // Fetches and executes the script at the given URL on stack top.
    // The script is run asynchronously.
    defns.fs = async function (sel, pstack, dstack, defns) {
        async function runscript(sel) {
            let response = await fetch(dstack.car);
            if (response.ok) {
                let scr = await response.text();
                let pstack = psProg(scr);
                return forth(sel, pstack, dstack.cdr, defns);
            }
        }
        runscript(sel);
        return forth(sel, pstack, dstack.cdr, defns);
    };
    // {key1:val1; key2:val2;...} style
    // Sets the style of the currently selected elements.
    // You can also given an array with an even number of
    // elements where the even indices are keys and the odd
    // indices are corresponding values.
    defns.style = function (sel, pstack, dstack, defns) {
        let txt = dstack.car;
        if (typeof(txt) === 'string') {
            lines = txt.split(";");
            for (let line of lines) {
                let parts = line.split(":");
                for (let el of sel) {
                    el.style[parts[0].trim()] = parts[1].trim();
                }
            }
        } else if (txt instanceof Array) {
            let kvs = txt;
            if (kvs.length % 2 !== 0) {
                throw new Error("Style spec must consist of key-value pairs, so even number of elements expected");
            }
            for (let i = 0; i < kvs.length; i += 2) {
                let k = kvs[i];
                let v = kvs[i+1];
                for (let el of sel) {
                    el.style[k] = v;
                }
            }
        }
        return forth(sel, pstack, dstack.cdr, defns);
    }
    // text
    // Gets the innerText of the current selection and places
    // it on the stack.
    defns.text = function (sel, pstack, dstack, defns) {
        // Gets the text contents of the currently selected elements.
        let text =[];
        for (let el of sel) {
            text.push(el.innerText);
        }
        return forth(sel, pstack, cons(text.join("\n\n"), dstack), defns);
    };
    const knownVocabs = {}; // Key is URL, value is parsed program code.
    defns.vocab = async function (sel, ps, ds, defns) {
        // #lang:
        // Intended to be used like 
        //  ({selector} sel {url} vocab)
        // will choose the selector as the recipient of the vocabulary.
        let url = ds.car;
        if (url in knownVocabs) {
            try {
                await forth(sel, knownVocabs[url], empty(), defns);
            } catch (e) {
                console.error(e);
                throw new Error("Problem with known vocabulary at url " + url);
            }
            return forth(sel, ps, ds.cdr, defns);
        } else {
            let response = await fetch(url);
            if (response.ok) {
                let code = await response.text();
                try {
                    knownVocabs[url] = psProg(code);
                    await forth(sel, knownVocabs[url], empty(), defns);
                } catch (e) {
                    console.error(e);
                    throw new Error("Problem with vocabulary code at url " + url);
                }
                return forth(sel, ps, ds.cdr, defns);
            } else {
                throw new Error("Vocabulary fetch failure");
            }
        }
    };

    return defns;
}

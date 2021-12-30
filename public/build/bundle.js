
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    const missing_component = {
        $$render: () => ''
    };

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.3' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\Search.svelte generated by Svelte v3.44.3 */

    const file$4 = "src\\Search.svelte";

    function create_fragment$4(ctx) {
    	let div;
    	let input;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			button = element("button");
    			button.textContent = "Gen";
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "svelte-1kfb5r7");
    			add_location(input, file$4, 32, 4, 607);
    			attr_dev(button, "class", "svelte-1kfb5r7");
    			add_location(button, file$4, 33, 4, 700);
    			attr_dev(div, "class", "container svelte-1kfb5r7");
    			add_location(div, file$4, 31, 0, 578);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			set_input_value(input, /*query*/ ctx[0]);
    			append_dev(div, t0);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "keypress", /*keypress_handler*/ ctx[4], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[5]),
    					listen_dev(button, "click", /*gen*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*query*/ 1 && input.value !== /*query*/ ctx[0]) {
    				set_input_value(input, /*query*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Search', slots, []);
    	let query;
    	let { check } = $$props;
    	let { generate } = $$props;

    	let gen = () => {
    		check(query);
    		generate(query);
    	};

    	const writable_props = ['check', 'generate'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Search> was created with unknown prop '${key}'`);
    	});

    	const keypress_handler = e => {
    		if (e.key == 'Enter') {
    			gen();
    		}
    	};

    	function input_input_handler() {
    		query = this.value;
    		$$invalidate(0, query);
    	}

    	$$self.$$set = $$props => {
    		if ('check' in $$props) $$invalidate(2, check = $$props.check);
    		if ('generate' in $$props) $$invalidate(3, generate = $$props.generate);
    	};

    	$$self.$capture_state = () => ({ query, check, generate, gen });

    	$$self.$inject_state = $$props => {
    		if ('query' in $$props) $$invalidate(0, query = $$props.query);
    		if ('check' in $$props) $$invalidate(2, check = $$props.check);
    		if ('generate' in $$props) $$invalidate(3, generate = $$props.generate);
    		if ('gen' in $$props) $$invalidate(1, gen = $$props.gen);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [query, gen, check, generate, keypress_handler, input_input_handler];
    }

    class Search extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { check: 2, generate: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Search",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*check*/ ctx[2] === undefined && !('check' in props)) {
    			console.warn("<Search> was created without expected prop 'check'");
    		}

    		if (/*generate*/ ctx[3] === undefined && !('generate' in props)) {
    			console.warn("<Search> was created without expected prop 'generate'");
    		}
    	}

    	get check() {
    		throw new Error("<Search>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set check(value) {
    		throw new Error("<Search>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get generate() {
    		throw new Error("<Search>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set generate(value) {
    		throw new Error("<Search>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Line.svelte generated by Svelte v3.44.3 */

    const file$3 = "src\\Line.svelte";

    // (57:28) 
    function create_if_block_7(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[0].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t3;
    	let span2;
    	let t4_value = /*line*/ ctx[0].formula + "";
    	let t4;

    	const block = {
    		c: function create() {
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			span1.textContent = "B";
    			t3 = space();
    			span2 = element("span");
    			t4 = text(t4_value);
    			attr_dev(span0, "class", "ln svelte-14q7y6k");
    			add_location(span0, file$3, 57, 4, 2233);
    			attr_dev(span1, "class", "reason svelte-14q7y6k");
    			add_location(span1, file$3, 58, 4, 2272);
    			attr_dev(span2, "class", "formula svelte-14q7y6k");
    			add_location(span2, file$3, 59, 4, 2307);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, span2, anchor);
    			append_dev(span2, t4);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*line*/ 1 && t0_value !== (t0_value = /*line*/ ctx[0].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 1 && t4_value !== (t4_value = /*line*/ ctx[0].formula + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(span2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(57:28) ",
    		ctx
    	});

    	return block;
    }

    // (54:27) 
    function create_if_block_6(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[0].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = /*line*/ ctx[0].src + "";
    	let t3;
    	let t4;
    	let t5_value = /*line*/ ctx[0].min_src + "";
    	let t5;
    	let t6;

    	const block = {
    		c: function create() {
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			t2 = text("X(");
    			t3 = text(t3_value);
    			t4 = text(",");
    			t5 = text(t5_value);
    			t6 = text(")");
    			attr_dev(span0, "class", "ln svelte-14q7y6k");
    			add_location(span0, file$3, 54, 4, 2102);
    			attr_dev(span1, "class", "reason svelte-14q7y6k");
    			add_location(span1, file$3, 55, 4, 2141);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    			append_dev(span1, t2);
    			append_dev(span1, t3);
    			append_dev(span1, t4);
    			append_dev(span1, t5);
    			append_dev(span1, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*line*/ 1 && t0_value !== (t0_value = /*line*/ ctx[0].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 1 && t3_value !== (t3_value = /*line*/ ctx[0].src + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 1 && t5_value !== (t5_value = /*line*/ ctx[0].min_src + "")) set_data_dev(t5, t5_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(54:27) ",
    		ctx
    	});

    	return block;
    }

    // (51:27) 
    function create_if_block_5(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[0].ln + "";
    	let t0;
    	let t1;
    	let span1;

    	const block = {
    		c: function create() {
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			span1.textContent = "OPEN";
    			attr_dev(span0, "class", "ln svelte-14q7y6k");
    			add_location(span0, file$3, 51, 4, 1984);
    			attr_dev(span1, "class", "reason reason-full svelte-14q7y6k");
    			add_location(span1, file$3, 52, 4, 2023);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*line*/ 1 && t0_value !== (t0_value = /*line*/ ctx[0].ln + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(51:27) ",
    		ctx
    	});

    	return block;
    }

    // (47:27) 
    function create_if_block_4(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[0].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = (/*line*/ ctx[0].src, /*line*/ ctx[0].min_src) + "";
    	let t3;
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*line*/ ctx[0].formula + "";
    	let t6;

    	const block = {
    		c: function create() {
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			t2 = text("η(");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			span2 = element("span");
    			t6 = text(t6_value);
    			attr_dev(span0, "class", "ln svelte-14q7y6k");
    			add_location(span0, file$3, 47, 4, 1804);
    			attr_dev(span1, "class", "reason svelte-14q7y6k");
    			add_location(span1, file$3, 48, 4, 1843);
    			attr_dev(span2, "class", "formula svelte-14q7y6k");
    			add_location(span2, file$3, 49, 4, 1906);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    			append_dev(span1, t2);
    			append_dev(span1, t3);
    			append_dev(span1, t4);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, span2, anchor);
    			append_dev(span2, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*line*/ 1 && t0_value !== (t0_value = /*line*/ ctx[0].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 1 && t3_value !== (t3_value = (/*line*/ ctx[0].src, /*line*/ ctx[0].min_src) + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 1 && t6_value !== (t6_value = /*line*/ ctx[0].formula + "")) set_data_dev(t6, t6_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(span2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(47:27) ",
    		ctx
    	});

    	return block;
    }

    // (43:27) 
    function create_if_block_3(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[0].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = (/*line*/ ctx[0].src, /*line*/ ctx[0].min_src) + "";
    	let t3;
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*line*/ ctx[0].formula + "";
    	let t6;

    	const block = {
    		c: function create() {
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			t2 = text("β(");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			span2 = element("span");
    			t6 = text(t6_value);
    			attr_dev(span0, "class", "ln svelte-14q7y6k");
    			add_location(span0, file$3, 43, 4, 1624);
    			attr_dev(span1, "class", "reason svelte-14q7y6k");
    			add_location(span1, file$3, 44, 4, 1663);
    			attr_dev(span2, "class", "formula svelte-14q7y6k");
    			add_location(span2, file$3, 45, 4, 1726);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    			append_dev(span1, t2);
    			append_dev(span1, t3);
    			append_dev(span1, t4);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, span2, anchor);
    			append_dev(span2, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*line*/ 1 && t0_value !== (t0_value = /*line*/ ctx[0].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 1 && t3_value !== (t3_value = (/*line*/ ctx[0].src, /*line*/ ctx[0].min_src) + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 1 && t6_value !== (t6_value = /*line*/ ctx[0].formula + "")) set_data_dev(t6, t6_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(span2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(43:27) ",
    		ctx
    	});

    	return block;
    }

    // (39:27) 
    function create_if_block_2(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[0].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = /*line*/ ctx[0].src + "";
    	let t3;
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*line*/ ctx[0].formula + "";
    	let t6;

    	const block = {
    		c: function create() {
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			t2 = text("α(");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			span2 = element("span");
    			t6 = text(t6_value);
    			attr_dev(span0, "class", "ln svelte-14q7y6k");
    			add_location(span0, file$3, 39, 4, 1460);
    			attr_dev(span1, "class", "reason svelte-14q7y6k");
    			add_location(span1, file$3, 40, 4, 1499);
    			attr_dev(span2, "class", "formula svelte-14q7y6k");
    			add_location(span2, file$3, 41, 4, 1546);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    			append_dev(span1, t2);
    			append_dev(span1, t3);
    			append_dev(span1, t4);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, span2, anchor);
    			append_dev(span2, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*line*/ 1 && t0_value !== (t0_value = /*line*/ ctx[0].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 1 && t3_value !== (t3_value = /*line*/ ctx[0].src + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 1 && t6_value !== (t6_value = /*line*/ ctx[0].formula + "")) set_data_dev(t6, t6_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(span2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(39:27) ",
    		ctx
    	});

    	return block;
    }

    // (35:28) 
    function create_if_block_1$2(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[0].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = /*line*/ ctx[0].src + "";
    	let t3;
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*line*/ ctx[0].formula + "";
    	let t6;

    	const block = {
    		c: function create() {
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			t2 = text("DNE(");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			span2 = element("span");
    			t6 = text(t6_value);
    			attr_dev(span0, "class", "ln svelte-14q7y6k");
    			add_location(span0, file$3, 35, 4, 1294);
    			attr_dev(span1, "class", "reason svelte-14q7y6k");
    			add_location(span1, file$3, 36, 4, 1333);
    			attr_dev(span2, "class", "formula svelte-14q7y6k");
    			add_location(span2, file$3, 37, 4, 1382);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    			append_dev(span1, t2);
    			append_dev(span1, t3);
    			append_dev(span1, t4);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, span2, anchor);
    			append_dev(span2, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*line*/ 1 && t0_value !== (t0_value = /*line*/ ctx[0].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 1 && t3_value !== (t3_value = /*line*/ ctx[0].src + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 1 && t6_value !== (t6_value = /*line*/ ctx[0].formula + "")) set_data_dev(t6, t6_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(span2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(35:28) ",
    		ctx
    	});

    	return block;
    }

    // (31:0) {#if line.type == "p"}
    function create_if_block$2(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[0].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t3;
    	let span2;
    	let t4_value = /*line*/ ctx[0].formula + "";
    	let t4;

    	const block = {
    		c: function create() {
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			span1.textContent = "P";
    			t3 = space();
    			span2 = element("span");
    			t4 = text(t4_value);
    			attr_dev(span0, "class", "ln svelte-14q7y6k");
    			add_location(span0, file$3, 31, 4, 1141);
    			attr_dev(span1, "class", "reason svelte-14q7y6k");
    			add_location(span1, file$3, 32, 4, 1180);
    			attr_dev(span2, "class", "formula svelte-14q7y6k");
    			add_location(span2, file$3, 33, 4, 1215);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, span2, anchor);
    			append_dev(span2, t4);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*line*/ 1 && t0_value !== (t0_value = /*line*/ ctx[0].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 1 && t4_value !== (t4_value = /*line*/ ctx[0].formula + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(span2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(31:0) {#if line.type == \\\"p\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*line*/ ctx[0].type == "p") return create_if_block$2;
    		if (/*line*/ ctx[0].type == "ne") return create_if_block_1$2;
    		if (/*line*/ ctx[0].type == "a") return create_if_block_2;
    		if (/*line*/ ctx[0].type == "b") return create_if_block_3;
    		if (/*line*/ ctx[0].type == "e") return create_if_block_4;
    		if (/*line*/ ctx[0].type == "o") return create_if_block_5;
    		if (/*line*/ ctx[0].type == "c") return create_if_block_6;
    		if (/*line*/ ctx[0].type == "br") return create_if_block_7;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) {
    				if_block.d(detaching);
    			}

    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Line', slots, []);
    	let { line } = $$props;
    	const writable_props = ['line'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Line> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('line' in $$props) $$invalidate(0, line = $$props.line);
    	};

    	$$self.$capture_state = () => ({ line });

    	$$self.$inject_state = $$props => {
    		if ('line' in $$props) $$invalidate(0, line = $$props.line);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [line];
    }

    class Line extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { line: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Line",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*line*/ ctx[0] === undefined && !('line' in props)) {
    			console.warn("<Line> was created without expected prop 'line'");
    		}
    	}

    	get line() {
    		throw new Error("<Line>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set line(value) {
    		throw new Error("<Line>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Connect.svelte generated by Svelte v3.44.3 */

    const { window: window_1 } = globals;
    const file$2 = "src\\Connect.svelte";

    function create_fragment$2(ctx) {
    	let svg_1;
    	let line;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			svg_1 = svg_element("svg");
    			line = svg_element("line");
    			attr_dev(line, "x1", /*x1*/ ctx[3]);
    			attr_dev(line, "x2", /*x2*/ ctx[5]);
    			attr_dev(line, "y1", /*y1*/ ctx[4]);
    			attr_dev(line, "y2", /*y2*/ ctx[6]);
    			attr_dev(line, "class", "svelte-db62ha");
    			add_location(line, file$2, 45, 4, 1015);
    			set_style(svg_1, "top", /*y*/ ctx[2] + "px");
    			set_style(svg_1, "left", /*x*/ ctx[1] + "px");
    			set_style(svg_1, "width", /*width*/ ctx[7] + "px");
    			set_style(svg_1, "height", /*height*/ ctx[8] + "px");
    			attr_dev(svg_1, "class", "svelte-db62ha");
    			add_location(svg_1, file$2, 44, 0, 924);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg_1, anchor);
    			append_dev(svg_1, line);
    			/*svg_1_binding*/ ctx[13](svg_1);

    			if (!mounted) {
    				dispose = listen_dev(window_1, "resize", /*resize_handler*/ ctx[12], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*x1*/ 8) {
    				attr_dev(line, "x1", /*x1*/ ctx[3]);
    			}

    			if (dirty & /*x2*/ 32) {
    				attr_dev(line, "x2", /*x2*/ ctx[5]);
    			}

    			if (dirty & /*y1*/ 16) {
    				attr_dev(line, "y1", /*y1*/ ctx[4]);
    			}

    			if (dirty & /*y2*/ 64) {
    				attr_dev(line, "y2", /*y2*/ ctx[6]);
    			}

    			if (dirty & /*y*/ 4) {
    				set_style(svg_1, "top", /*y*/ ctx[2] + "px");
    			}

    			if (dirty & /*x*/ 2) {
    				set_style(svg_1, "left", /*x*/ ctx[1] + "px");
    			}

    			if (dirty & /*width*/ 128) {
    				set_style(svg_1, "width", /*width*/ ctx[7] + "px");
    			}

    			if (dirty & /*height*/ 256) {
    				set_style(svg_1, "height", /*height*/ ctx[8] + "px");
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg_1);
    			/*svg_1_binding*/ ctx[13](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Connect', slots, []);
    	let { start } = $$props;
    	let { end } = $$props;
    	let update = 1;
    	let x = 0, y = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0, width = 0, height = 0;
    	var svg;
    	const writable_props = ['start', 'end'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Connect> was created with unknown prop '${key}'`);
    	});

    	const resize_handler = () => $$invalidate(0, update += 1);

    	function svg_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			svg = $$value;
    			$$invalidate(9, svg);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('start' in $$props) $$invalidate(10, start = $$props.start);
    		if ('end' in $$props) $$invalidate(11, end = $$props.end);
    	};

    	$$self.$capture_state = () => ({
    		missing_component,
    		start,
    		end,
    		update,
    		x,
    		y,
    		x1,
    		y1,
    		x2,
    		y2,
    		width,
    		height,
    		svg
    	});

    	$$self.$inject_state = $$props => {
    		if ('start' in $$props) $$invalidate(10, start = $$props.start);
    		if ('end' in $$props) $$invalidate(11, end = $$props.end);
    		if ('update' in $$props) $$invalidate(0, update = $$props.update);
    		if ('x' in $$props) $$invalidate(1, x = $$props.x);
    		if ('y' in $$props) $$invalidate(2, y = $$props.y);
    		if ('x1' in $$props) $$invalidate(3, x1 = $$props.x1);
    		if ('y1' in $$props) $$invalidate(4, y1 = $$props.y1);
    		if ('x2' in $$props) $$invalidate(5, x2 = $$props.x2);
    		if ('y2' in $$props) $$invalidate(6, y2 = $$props.y2);
    		if ('width' in $$props) $$invalidate(7, width = $$props.width);
    		if ('height' in $$props) $$invalidate(8, height = $$props.height);
    		if ('svg' in $$props) $$invalidate(9, svg = $$props.svg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*start, end, update, x1, x2, y1, y2, x, y*/ 3199) {
    			if (start && end && update) {
    				let sbb = start.getBoundingClientRect();
    				let ebb = end.getBoundingClientRect();
    				$$invalidate(3, x1 = sbb.x + sbb.width / 2 + window.scrollX);
    				$$invalidate(4, y1 = sbb.bottom + window.scrollY);
    				$$invalidate(5, x2 = ebb.x + ebb.width / 2 + window.scrollX);
    				$$invalidate(6, y2 = ebb.top + window.scrollY);
    				$$invalidate(1, x = Math.min(x1, x2));
    				$$invalidate(2, y = Math.min(y1, y2));
    				$$invalidate(3, x1 -= x);
    				$$invalidate(4, y1 -= y);
    				$$invalidate(5, x2 -= x);
    				$$invalidate(6, y2 -= y);
    				$$invalidate(7, width = Math.abs(x2 - x1));
    				$$invalidate(8, height = Math.abs(y2 - y1));
    			}
    		}
    	};

    	return [
    		update,
    		x,
    		y,
    		x1,
    		y1,
    		x2,
    		y2,
    		width,
    		height,
    		svg,
    		start,
    		end,
    		resize_handler,
    		svg_1_binding
    	];
    }

    class Connect extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { start: 10, end: 11 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Connect",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*start*/ ctx[10] === undefined && !('start' in props)) {
    			console.warn("<Connect> was created without expected prop 'start'");
    		}

    		if (/*end*/ ctx[11] === undefined && !('end' in props)) {
    			console.warn("<Connect> was created without expected prop 'end'");
    		}
    	}

    	get start() {
    		throw new Error("<Connect>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set start(value) {
    		throw new Error("<Connect>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get end() {
    		throw new Error("<Connect>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set end(value) {
    		throw new Error("<Connect>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Tree.svelte generated by Svelte v3.44.3 */
    const file$1 = "src\\Tree.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	return child_ctx;
    }

    // (22:12) {#if line.type != "bc"}
    function create_if_block_1$1(ctx) {
    	let line;
    	let current;

    	line = new Line({
    			props: { line: /*line*/ ctx[11] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(line.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(line, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const line_changes = {};
    			if (dirty & /*lines*/ 4) line_changes.line = /*line*/ ctx[11];
    			line.$set(line_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(line.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(line.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(line, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(22:12) {#if line.type != \\\"bc\\\"}",
    		ctx
    	});

    	return block;
    }

    // (21:8) {#each lines as line}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*line*/ ctx[11].type != "bc" && create_if_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*line*/ ctx[11].type != "bc") {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*lines*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_1$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(21:8) {#each lines as line}",
    		ctx
    	});

    	return block;
    }

    // (29:0) {#if has_branch}
    function create_if_block$1(ctx) {
    	let connect0;
    	let t0;
    	let connect1;
    	let t1;
    	let div2;
    	let div0;
    	let tree0;
    	let updating_highlights;
    	let updating_box;
    	let t2;
    	let div1;
    	let tree1;
    	let updating_highlights_1;
    	let updating_box_1;
    	let current;

    	connect0 = new Connect({
    			props: {
    				start: /*box*/ ctx[1],
    				end: /*left*/ ctx[4]
    			},
    			$$inline: true
    		});

    	connect1 = new Connect({
    			props: {
    				start: /*box*/ ctx[1],
    				end: /*right*/ ctx[5]
    			},
    			$$inline: true
    		});

    	function tree0_highlights_binding(value) {
    		/*tree0_highlights_binding*/ ctx[7](value);
    	}

    	function tree0_box_binding(value) {
    		/*tree0_box_binding*/ ctx[8](value);
    	}

    	let tree0_props = { lines: /*lines*/ ctx[2].at(-1).left };

    	if (/*highlights*/ ctx[0] !== void 0) {
    		tree0_props.highlights = /*highlights*/ ctx[0];
    	}

    	if (/*left*/ ctx[4] !== void 0) {
    		tree0_props.box = /*left*/ ctx[4];
    	}

    	tree0 = new Tree({ props: tree0_props, $$inline: true });
    	binding_callbacks.push(() => bind(tree0, 'highlights', tree0_highlights_binding));
    	binding_callbacks.push(() => bind(tree0, 'box', tree0_box_binding));

    	function tree1_highlights_binding(value) {
    		/*tree1_highlights_binding*/ ctx[9](value);
    	}

    	function tree1_box_binding(value) {
    		/*tree1_box_binding*/ ctx[10](value);
    	}

    	let tree1_props = { lines: /*lines*/ ctx[2].at(-1).right };

    	if (/*highlights*/ ctx[0] !== void 0) {
    		tree1_props.highlights = /*highlights*/ ctx[0];
    	}

    	if (/*right*/ ctx[5] !== void 0) {
    		tree1_props.box = /*right*/ ctx[5];
    	}

    	tree1 = new Tree({ props: tree1_props, $$inline: true });
    	binding_callbacks.push(() => bind(tree1, 'highlights', tree1_highlights_binding));
    	binding_callbacks.push(() => bind(tree1, 'box', tree1_box_binding));

    	const block = {
    		c: function create() {
    			create_component(connect0.$$.fragment);
    			t0 = space();
    			create_component(connect1.$$.fragment);
    			t1 = space();
    			div2 = element("div");
    			div0 = element("div");
    			create_component(tree0.$$.fragment);
    			t2 = space();
    			div1 = element("div");
    			create_component(tree1.$$.fragment);
    			attr_dev(div0, "class", "split split-left svelte-phgve9");
    			add_location(div0, file$1, 32, 8, 744);
    			attr_dev(div1, "class", "split split-right svelte-phgve9");
    			add_location(div1, file$1, 39, 8, 951);
    			attr_dev(div2, "class", "split-container svelte-phgve9");
    			add_location(div2, file$1, 31, 4, 705);
    		},
    		m: function mount(target, anchor) {
    			mount_component(connect0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(connect1, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			mount_component(tree0, div0, null);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			mount_component(tree1, div1, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const connect0_changes = {};
    			if (dirty & /*box*/ 2) connect0_changes.start = /*box*/ ctx[1];
    			if (dirty & /*left*/ 16) connect0_changes.end = /*left*/ ctx[4];
    			connect0.$set(connect0_changes);
    			const connect1_changes = {};
    			if (dirty & /*box*/ 2) connect1_changes.start = /*box*/ ctx[1];
    			if (dirty & /*right*/ 32) connect1_changes.end = /*right*/ ctx[5];
    			connect1.$set(connect1_changes);
    			const tree0_changes = {};
    			if (dirty & /*lines*/ 4) tree0_changes.lines = /*lines*/ ctx[2].at(-1).left;

    			if (!updating_highlights && dirty & /*highlights*/ 1) {
    				updating_highlights = true;
    				tree0_changes.highlights = /*highlights*/ ctx[0];
    				add_flush_callback(() => updating_highlights = false);
    			}

    			if (!updating_box && dirty & /*left*/ 16) {
    				updating_box = true;
    				tree0_changes.box = /*left*/ ctx[4];
    				add_flush_callback(() => updating_box = false);
    			}

    			tree0.$set(tree0_changes);
    			const tree1_changes = {};
    			if (dirty & /*lines*/ 4) tree1_changes.lines = /*lines*/ ctx[2].at(-1).right;

    			if (!updating_highlights_1 && dirty & /*highlights*/ 1) {
    				updating_highlights_1 = true;
    				tree1_changes.highlights = /*highlights*/ ctx[0];
    				add_flush_callback(() => updating_highlights_1 = false);
    			}

    			if (!updating_box_1 && dirty & /*right*/ 32) {
    				updating_box_1 = true;
    				tree1_changes.box = /*right*/ ctx[5];
    				add_flush_callback(() => updating_box_1 = false);
    			}

    			tree1.$set(tree1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(connect0.$$.fragment, local);
    			transition_in(connect1.$$.fragment, local);
    			transition_in(tree0.$$.fragment, local);
    			transition_in(tree1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(connect0.$$.fragment, local);
    			transition_out(connect1.$$.fragment, local);
    			transition_out(tree0.$$.fragment, local);
    			transition_out(tree1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(connect0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(connect1, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div2);
    			destroy_component(tree0);
    			destroy_component(tree1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(29:0) {#if has_branch}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let div0;
    	let t;
    	let if_block_anchor;
    	let current;
    	let each_value = /*lines*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let if_block = /*has_branch*/ ctx[3] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(div0, "class", "section-grid svelte-phgve9");
    			add_location(div0, file$1, 19, 4, 399);
    			attr_dev(div1, "class", "section-container svelte-phgve9");
    			add_location(div1, file$1, 18, 0, 362);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			/*div0_binding*/ ctx[6](div0);
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*lines*/ 4) {
    				each_value = /*lines*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div0, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (/*has_branch*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*has_branch*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    			/*div0_binding*/ ctx[6](null);
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tree', slots, []);
    	let { lines } = $$props;
    	let { highlights } = $$props;
    	let { box } = $$props;
    	let has_branch;
    	let left = false;
    	let right = false;
    	const writable_props = ['lines', 'highlights', 'box'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Tree> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			box = $$value;
    			$$invalidate(1, box);
    		});
    	}

    	function tree0_highlights_binding(value) {
    		highlights = value;
    		$$invalidate(0, highlights);
    	}

    	function tree0_box_binding(value) {
    		left = value;
    		$$invalidate(4, left);
    	}

    	function tree1_highlights_binding(value) {
    		highlights = value;
    		$$invalidate(0, highlights);
    	}

    	function tree1_box_binding(value) {
    		right = value;
    		$$invalidate(5, right);
    	}

    	$$self.$$set = $$props => {
    		if ('lines' in $$props) $$invalidate(2, lines = $$props.lines);
    		if ('highlights' in $$props) $$invalidate(0, highlights = $$props.highlights);
    		if ('box' in $$props) $$invalidate(1, box = $$props.box);
    	};

    	$$self.$capture_state = () => ({
    		Line,
    		Connect,
    		lines,
    		highlights,
    		box,
    		has_branch,
    		left,
    		right
    	});

    	$$self.$inject_state = $$props => {
    		if ('lines' in $$props) $$invalidate(2, lines = $$props.lines);
    		if ('highlights' in $$props) $$invalidate(0, highlights = $$props.highlights);
    		if ('box' in $$props) $$invalidate(1, box = $$props.box);
    		if ('has_branch' in $$props) $$invalidate(3, has_branch = $$props.has_branch);
    		if ('left' in $$props) $$invalidate(4, left = $$props.left);
    		if ('right' in $$props) $$invalidate(5, right = $$props.right);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*lines*/ 4) {
    			$$invalidate(3, has_branch = lines.length != 0 ? lines.at(-1).type == "bc" : false);
    		}
    	};

    	return [
    		highlights,
    		box,
    		lines,
    		has_branch,
    		left,
    		right,
    		div0_binding,
    		tree0_highlights_binding,
    		tree0_box_binding,
    		tree1_highlights_binding,
    		tree1_box_binding
    	];
    }

    class Tree extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { lines: 2, highlights: 0, box: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tree",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*lines*/ ctx[2] === undefined && !('lines' in props)) {
    			console.warn("<Tree> was created without expected prop 'lines'");
    		}

    		if (/*highlights*/ ctx[0] === undefined && !('highlights' in props)) {
    			console.warn("<Tree> was created without expected prop 'highlights'");
    		}

    		if (/*box*/ ctx[1] === undefined && !('box' in props)) {
    			console.warn("<Tree> was created without expected prop 'box'");
    		}
    	}

    	get lines() {
    		throw new Error("<Tree>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lines(value) {
    		throw new Error("<Tree>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get highlights() {
    		throw new Error("<Tree>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set highlights(value) {
    		throw new Error("<Tree>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get box() {
    		throw new Error("<Tree>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set box(value) {
    		throw new Error("<Tree>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.44.3 */
    const file = "src\\App.svelte";

    // (25:22) 
    function create_if_block_1(ctx) {
    	let div;
    	let tree_1;
    	let current;

    	tree_1 = new Tree({
    			props: { highlights: [], lines: /*tree*/ ctx[3] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(tree_1.$$.fragment);
    			attr_dev(div, "class", "tree-cont svelte-5c8gny");
    			add_location(div, file, 25, 2, 636);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(tree_1, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tree_1_changes = {};
    			if (dirty & /*tree*/ 8) tree_1_changes.lines = /*tree*/ ctx[3];
    			tree_1.$set(tree_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tree_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tree_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(tree_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(25:22) ",
    		ctx
    	});

    	return block;
    }

    // (23:1) {#if use_text}
    function create_if_block(ctx) {
    	let code;
    	let t;

    	const block = {
    		c: function create() {
    			code = element("code");
    			t = text(/*tree_text*/ ctx[2]);
    			attr_dev(code, "class", "svelte-5c8gny");
    			add_location(code, file, 23, 2, 586);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, code, anchor);
    			append_dev(code, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tree_text*/ 4) set_data_dev(t, /*tree_text*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(code);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(23:1) {#if use_text}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t0;
    	let t1;
    	let search;
    	let updating_check;
    	let updating_generate;
    	let t2;
    	let current_block_type_index;
    	let if_block;
    	let current;

    	function search_check_binding(value) {
    		/*search_check_binding*/ ctx[6](value);
    	}

    	function search_generate_binding(value) {
    		/*search_generate_binding*/ ctx[7](value);
    	}

    	let search_props = {};

    	if (/*try_get_header*/ ctx[1] !== void 0) {
    		search_props.check = /*try_get_header*/ ctx[1];
    	}

    	if (/*try_gen_tree*/ ctx[4] !== void 0) {
    		search_props.generate = /*try_gen_tree*/ ctx[4];
    	}

    	search = new Search({ props: search_props, $$inline: true });
    	binding_callbacks.push(() => bind(search, 'check', search_check_binding));
    	binding_callbacks.push(() => bind(search, 'generate', search_generate_binding));
    	const if_block_creators = [create_if_block, create_if_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*use_text*/ ctx[5]) return 0;
    		if (/*tree*/ ctx[3] != []) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text(/*header_text*/ ctx[0]);
    			t1 = space();
    			create_component(search.$$.fragment);
    			t2 = space();
    			if (if_block) if_block.c();
    			attr_dev(h1, "class", "svelte-5c8gny");
    			add_location(h1, file, 20, 1, 476);
    			attr_dev(main, "class", "svelte-5c8gny");
    			add_location(main, file, 19, 0, 468);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(h1, t0);
    			append_dev(main, t1);
    			mount_component(search, main, null);
    			append_dev(main, t2);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(main, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*header_text*/ 1) set_data_dev(t0, /*header_text*/ ctx[0]);
    			const search_changes = {};

    			if (!updating_check && dirty & /*try_get_header*/ 2) {
    				updating_check = true;
    				search_changes.check = /*try_get_header*/ ctx[1];
    				add_flush_callback(() => updating_check = false);
    			}

    			if (!updating_generate && dirty & /*try_gen_tree*/ 16) {
    				updating_generate = true;
    				search_changes.generate = /*try_gen_tree*/ ctx[4];
    				add_flush_callback(() => updating_generate = false);
    			}

    			search.$set(search_changes);
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					} else {
    						if_block.p(ctx, dirty);
    					}

    					transition_in(if_block, 1);
    					if_block.m(main, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(search.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(search.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(search);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let header_text = "Propositional Logic Tree Generator";

    	let try_get_header = query => {
    		$$invalidate(0, header_text = solver.gen_interpretation(query));
    	};

    	let tree_text = "";
    	let use_text = false;

    	let try_gen_tree_text = query => {
    		$$invalidate(2, tree_text = solver.gen_text_tree(query));
    	};

    	let tree = [];

    	let try_gen_tree = query => {
    		$$invalidate(3, tree = JSON.parse(solver.gen_tree(query)));
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function search_check_binding(value) {
    		try_get_header = value;
    		$$invalidate(1, try_get_header);
    	}

    	function search_generate_binding(value) {
    		try_gen_tree = value;
    		$$invalidate(4, try_gen_tree);
    	}

    	$$self.$capture_state = () => ({
    		Search,
    		Tree,
    		header_text,
    		try_get_header,
    		tree_text,
    		use_text,
    		try_gen_tree_text,
    		tree,
    		try_gen_tree
    	});

    	$$self.$inject_state = $$props => {
    		if ('header_text' in $$props) $$invalidate(0, header_text = $$props.header_text);
    		if ('try_get_header' in $$props) $$invalidate(1, try_get_header = $$props.try_get_header);
    		if ('tree_text' in $$props) $$invalidate(2, tree_text = $$props.tree_text);
    		if ('use_text' in $$props) $$invalidate(5, use_text = $$props.use_text);
    		if ('try_gen_tree_text' in $$props) try_gen_tree_text = $$props.try_gen_tree_text;
    		if ('tree' in $$props) $$invalidate(3, tree = $$props.tree);
    		if ('try_gen_tree' in $$props) $$invalidate(4, try_gen_tree = $$props.try_gen_tree);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		header_text,
    		try_get_header,
    		tree_text,
    		tree,
    		try_gen_tree,
    		use_text,
    		search_check_binding,
    		search_generate_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map

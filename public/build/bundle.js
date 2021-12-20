
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
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
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

    const file$1 = "src\\Search.svelte";

    function create_fragment$1(ctx) {
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
    			attr_dev(input, "class", "svelte-1mhr4pu");
    			add_location(input, file$1, 32, 4, 607);
    			attr_dev(button, "class", "svelte-1mhr4pu");
    			add_location(button, file$1, 33, 4, 700);
    			attr_dev(div, "class", "container svelte-1mhr4pu");
    			add_location(div, file$1, 31, 0, 578);
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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { check: 2, generate: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Search",
    			options,
    			id: create_fragment$1.name
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

    /* src\App.svelte generated by Svelte v3.44.3 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t0;
    	let t1;
    	let search;
    	let updating_check;
    	let updating_generate;
    	let t2;
    	let code;
    	let t3;
    	let current;

    	function search_check_binding(value) {
    		/*search_check_binding*/ ctx[4](value);
    	}

    	function search_generate_binding(value) {
    		/*search_generate_binding*/ ctx[5](value);
    	}

    	let search_props = {};

    	if (/*try_get_header*/ ctx[2] !== void 0) {
    		search_props.check = /*try_get_header*/ ctx[2];
    	}

    	if (/*try_get_tree*/ ctx[3] !== void 0) {
    		search_props.generate = /*try_get_tree*/ ctx[3];
    	}

    	search = new Search({ props: search_props, $$inline: true });
    	binding_callbacks.push(() => bind(search, 'check', search_check_binding));
    	binding_callbacks.push(() => bind(search, 'generate', search_generate_binding));

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text(/*header_text*/ ctx[0]);
    			t1 = space();
    			create_component(search.$$.fragment);
    			t2 = space();
    			code = element("code");
    			t3 = text(/*tree_text*/ ctx[1]);
    			attr_dev(h1, "class", "svelte-bhfj6s");
    			add_location(h1, file, 41, 1, 655);
    			attr_dev(code, "class", "svelte-bhfj6s");
    			add_location(code, file, 43, 1, 755);
    			attr_dev(main, "class", "svelte-bhfj6s");
    			add_location(main, file, 40, 0, 647);
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
    			append_dev(main, code);
    			append_dev(code, t3);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*header_text*/ 1) set_data_dev(t0, /*header_text*/ ctx[0]);
    			const search_changes = {};

    			if (!updating_check && dirty & /*try_get_header*/ 4) {
    				updating_check = true;
    				search_changes.check = /*try_get_header*/ ctx[2];
    				add_flush_callback(() => updating_check = false);
    			}

    			if (!updating_generate && dirty & /*try_get_tree*/ 8) {
    				updating_generate = true;
    				search_changes.generate = /*try_get_tree*/ ctx[3];
    				add_flush_callback(() => updating_generate = false);
    			}

    			search.$set(search_changes);
    			if (!current || dirty & /*tree_text*/ 2) set_data_dev(t3, /*tree_text*/ ctx[1]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(search.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(search.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(search);
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
    	let tree_text = "";

    	let try_get_header = query => {
    		$$invalidate(0, header_text = solver.gen_interpretation(query));
    	};

    	let try_get_tree = query => {
    		$$invalidate(1, tree_text = solver.gen_text_tree(query));
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function search_check_binding(value) {
    		try_get_header = value;
    		$$invalidate(2, try_get_header);
    	}

    	function search_generate_binding(value) {
    		try_get_tree = value;
    		$$invalidate(3, try_get_tree);
    	}

    	$$self.$capture_state = () => ({
    		Search,
    		header_text,
    		tree_text,
    		try_get_header,
    		try_get_tree
    	});

    	$$self.$inject_state = $$props => {
    		if ('header_text' in $$props) $$invalidate(0, header_text = $$props.header_text);
    		if ('tree_text' in $$props) $$invalidate(1, tree_text = $$props.tree_text);
    		if ('try_get_header' in $$props) $$invalidate(2, try_get_header = $$props.try_get_header);
    		if ('try_get_tree' in $$props) $$invalidate(3, try_get_tree = $$props.try_get_tree);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		header_text,
    		tree_text,
    		try_get_header,
    		try_get_tree,
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
    	props: {
    		tree: [
    			{type: "p", ln: 0, formula: "a|b&c→d↔e"},
    			{type: "p", ln: 1, formula: "f↔g→h&i|j"},
    			{type: "bc", 
    				left: [
    					{type: "b", ln: 2, formula: "f↔g→h&i"},
    					{type: "bc", 
    						left: [
    							{type: "b", ln: 3, formula: "a"},
    							{type: "o", ln: 4}
    						],
    						right: [
    							{type: "b", ln: 3, formula: "¬a"},
    							{type: "b", ln: 4, src: 0, min_src: 3, formula: "b&c→d↔e"},
    							{type: "a", ln: 5, src: 4, formula: "b"},
    							{type: "a", ln: 6, src: 4, formula: "c→d↔e"},
    							{type: "bc", 
    								left: [
    									{type: "b", ln: 7, formula: "c"},
    									{type: "b", ln: 8, src: 6, min_src: 7, formula: "d↔e"},
    									{type: "bc", 
    										left: [
    											{type: "b", ln: 9, formula: "d"},
    											{type: "e", ln: 10, src: 8, min_src: 9, formula: "e"},
    											{type: "o", ln: 11}],
    												right: [
    													{type: "b", ln: 9, formula: "¬d"},
    													{type: "e", ln: 10, src: 8, min_src: 9, formula: "¬e"},
    													{type: "o", ln: 11}
    												]}
    											],
    											right: [
    												{type: "b", ln: 7, formula: "¬c"},
    												{type: "o", ln: 8}
    											]}
    										]}
    									],
    									right: [
    										{type: "b", ln: 2, formula: "¬(f↔g→h&i)"},
    										{type: "b", ln: 3, src: 1, min_src: 2, formula: "j"},
    										{type: "bc",
    											left: [
    												{type: "b", ln: 4, formula: "a"},
    												{type: "o", ln: 5}
    											],
    											right: [
    												{type: "b", ln: 4, formula: "¬a"},
    												{type: "b", ln: 5, src: 0, min_src: 4, formula: "b&c→d↔e"},
    												{type: "a", ln: 6, src: 5, formula: "b"},
    												{type: "a", ln: 7, src: 5, formula: "c→d↔e"},
    												{type: "bc", 
    													left: [
    														{type: "b", ln: 8, formula: "c"},
    														{type: "b", ln: 9, src: 7, min_src: 8, formula: "d↔e"},
    														{type: "bc",
    															left: [
    																{type: "b", ln: 10, formula: "d"},
    																{type: "e", ln: 11, src: 9, min_src: 10, formula: "e"},
    																{type: "o", ln: 12}
    															],
    															right: [
    																{type: "b", ln: 10, formula: "¬d"},
    																{type: "e", ln: 11, src: 9, min_src: 10, formula: "¬e"},
    																{type: "o", ln: 12}
    															]}
    														],
    														right: [
    															{type: "b", ln: 8, formula: "¬c"},
    															{type: "o", ln: 9}
    														]}
    													]}
    												]}
    											]
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map

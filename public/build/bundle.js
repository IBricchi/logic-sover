
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

    const file$2 = "src\\Search.svelte";

    function create_fragment$2(ctx) {
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
    			add_location(input, file$2, 32, 4, 607);
    			attr_dev(button, "class", "svelte-1mhr4pu");
    			add_location(button, file$2, 33, 4, 700);
    			attr_dev(div, "class", "container svelte-1mhr4pu");
    			add_location(div, file$2, 31, 0, 578);
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { check: 2, generate: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Search",
    			options,
    			id: create_fragment$2.name
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

    /* src\Tree.svelte generated by Svelte v3.44.3 */

    const { console: console_1$1 } = globals;
    const file$1 = "src\\Tree.svelte";

    // (98:36) 
    function create_if_block_10(ctx) {
    	let div2;
    	let div0;
    	let tree0;
    	let updating_max_line_size;
    	let updating_max_depth;
    	let updating_highlights;
    	let t;
    	let div1;
    	let tree1;
    	let updating_max_line_size_1;
    	let updating_max_depth_1;
    	let updating_highlights_1;
    	let current;

    	function tree0_max_line_size_binding(value) {
    		/*tree0_max_line_size_binding*/ ctx[15](value);
    	}

    	function tree0_max_depth_binding(value) {
    		/*tree0_max_depth_binding*/ ctx[16](value);
    	}

    	function tree0_highlights_binding(value) {
    		/*tree0_highlights_binding*/ ctx[17](value);
    	}

    	let tree0_props = {
    		lines: /*line*/ ctx[3].left,
    		depth: /*depth*/ ctx[2] + 1,
    		width: /*width*/ ctx[0]
    	};

    	if (/*child_max_line_size*/ ctx[4] !== void 0) {
    		tree0_props.max_line_size = /*child_max_line_size*/ ctx[4];
    	}

    	if (/*child_max_depth*/ ctx[5] !== void 0) {
    		tree0_props.max_depth = /*child_max_depth*/ ctx[5];
    	}

    	if (/*highlights*/ ctx[1] !== void 0) {
    		tree0_props.highlights = /*highlights*/ ctx[1];
    	}

    	tree0 = new Tree({ props: tree0_props, $$inline: true });
    	binding_callbacks.push(() => bind(tree0, 'max_line_size', tree0_max_line_size_binding));
    	binding_callbacks.push(() => bind(tree0, 'max_depth', tree0_max_depth_binding));
    	binding_callbacks.push(() => bind(tree0, 'highlights', tree0_highlights_binding));

    	function tree1_max_line_size_binding(value) {
    		/*tree1_max_line_size_binding*/ ctx[18](value);
    	}

    	function tree1_max_depth_binding(value) {
    		/*tree1_max_depth_binding*/ ctx[19](value);
    	}

    	function tree1_highlights_binding(value) {
    		/*tree1_highlights_binding*/ ctx[20](value);
    	}

    	let tree1_props = {
    		lines: /*line*/ ctx[3].right,
    		depth: /*depth*/ ctx[2] + 1,
    		width: /*width*/ ctx[0]
    	};

    	if (/*child_max_line_size*/ ctx[4] !== void 0) {
    		tree1_props.max_line_size = /*child_max_line_size*/ ctx[4];
    	}

    	if (/*child_max_depth*/ ctx[5] !== void 0) {
    		tree1_props.max_depth = /*child_max_depth*/ ctx[5];
    	}

    	if (/*highlights*/ ctx[1] !== void 0) {
    		tree1_props.highlights = /*highlights*/ ctx[1];
    	}

    	tree1 = new Tree({ props: tree1_props, $$inline: true });
    	binding_callbacks.push(() => bind(tree1, 'max_line_size', tree1_max_line_size_binding));
    	binding_callbacks.push(() => bind(tree1, 'max_depth', tree1_max_depth_binding));
    	binding_callbacks.push(() => bind(tree1, 'highlights', tree1_highlights_binding));

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			create_component(tree0.$$.fragment);
    			t = space();
    			div1 = element("div");
    			create_component(tree1.$$.fragment);
    			attr_dev(div0, "class", "split split-left svelte-dzbzd4");
    			add_location(div0, file$1, 101, 8, 3977);
    			attr_dev(div1, "class", "split split-right svelte-dzbzd4");
    			add_location(div1, file$1, 111, 8, 4309);
    			attr_dev(div2, "class", "split-container svelte-dzbzd4");
    			add_location(div2, file$1, 98, 4, 3725);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			mount_component(tree0, div0, null);
    			append_dev(div2, t);
    			append_dev(div2, div1);
    			mount_component(tree1, div1, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tree0_changes = {};
    			if (dirty & /*line*/ 8) tree0_changes.lines = /*line*/ ctx[3].left;
    			if (dirty & /*depth*/ 4) tree0_changes.depth = /*depth*/ ctx[2] + 1;
    			if (dirty & /*width*/ 1) tree0_changes.width = /*width*/ ctx[0];

    			if (!updating_max_line_size && dirty & /*child_max_line_size*/ 16) {
    				updating_max_line_size = true;
    				tree0_changes.max_line_size = /*child_max_line_size*/ ctx[4];
    				add_flush_callback(() => updating_max_line_size = false);
    			}

    			if (!updating_max_depth && dirty & /*child_max_depth*/ 32) {
    				updating_max_depth = true;
    				tree0_changes.max_depth = /*child_max_depth*/ ctx[5];
    				add_flush_callback(() => updating_max_depth = false);
    			}

    			if (!updating_highlights && dirty & /*highlights*/ 2) {
    				updating_highlights = true;
    				tree0_changes.highlights = /*highlights*/ ctx[1];
    				add_flush_callback(() => updating_highlights = false);
    			}

    			tree0.$set(tree0_changes);
    			const tree1_changes = {};
    			if (dirty & /*line*/ 8) tree1_changes.lines = /*line*/ ctx[3].right;
    			if (dirty & /*depth*/ 4) tree1_changes.depth = /*depth*/ ctx[2] + 1;
    			if (dirty & /*width*/ 1) tree1_changes.width = /*width*/ ctx[0];

    			if (!updating_max_line_size_1 && dirty & /*child_max_line_size*/ 16) {
    				updating_max_line_size_1 = true;
    				tree1_changes.max_line_size = /*child_max_line_size*/ ctx[4];
    				add_flush_callback(() => updating_max_line_size_1 = false);
    			}

    			if (!updating_max_depth_1 && dirty & /*child_max_depth*/ 32) {
    				updating_max_depth_1 = true;
    				tree1_changes.max_depth = /*child_max_depth*/ ctx[5];
    				add_flush_callback(() => updating_max_depth_1 = false);
    			}

    			if (!updating_highlights_1 && dirty & /*highlights*/ 2) {
    				updating_highlights_1 = true;
    				tree1_changes.highlights = /*highlights*/ ctx[1];
    				add_flush_callback(() => updating_highlights_1 = false);
    			}

    			tree1.$set(tree1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tree0.$$.fragment, local);
    			transition_in(tree1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tree0.$$.fragment, local);
    			transition_out(tree1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(tree0);
    			destroy_component(tree1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(98:36) ",
    		ctx
    	});

    	return block;
    }

    // (53:0) {#if child_lines && child_lines.length != 0}
    function create_if_block$1(ctx) {
    	let div;
    	let t;
    	let tree;
    	let updating_max_line_size;
    	let updating_max_depth;
    	let updating_highlights;
    	let current;
    	let if_block = /*line*/ ctx[3] && create_if_block_1$1(ctx);

    	function tree_max_line_size_binding(value) {
    		/*tree_max_line_size_binding*/ ctx[12](value);
    	}

    	function tree_max_depth_binding(value) {
    		/*tree_max_depth_binding*/ ctx[13](value);
    	}

    	function tree_highlights_binding(value) {
    		/*tree_highlights_binding*/ ctx[14](value);
    	}

    	let tree_props = {
    		lines: /*child_lines*/ ctx[6],
    		depth: /*depth*/ ctx[2],
    		width: /*width*/ ctx[0]
    	};

    	if (/*child_max_line_size*/ ctx[4] !== void 0) {
    		tree_props.max_line_size = /*child_max_line_size*/ ctx[4];
    	}

    	if (/*child_max_depth*/ ctx[5] !== void 0) {
    		tree_props.max_depth = /*child_max_depth*/ ctx[5];
    	}

    	if (/*highlights*/ ctx[1] !== void 0) {
    		tree_props.highlights = /*highlights*/ ctx[1];
    	}

    	tree = new Tree({ props: tree_props, $$inline: true });
    	binding_callbacks.push(() => bind(tree, 'max_line_size', tree_max_line_size_binding));
    	binding_callbacks.push(() => bind(tree, 'max_depth', tree_max_depth_binding));
    	binding_callbacks.push(() => bind(tree, 'highlights', tree_highlights_binding));

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			t = space();
    			create_component(tree.$$.fragment);
    			set_style(div, "width", /*width*/ ctx[0] + "pt");
    			attr_dev(div, "class", "line svelte-dzbzd4");
    			add_location(div, file$1, 53, 4, 1778);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			insert_dev(target, t, anchor);
    			mount_component(tree, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*line*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$1(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (!current || dirty & /*width*/ 1) {
    				set_style(div, "width", /*width*/ ctx[0] + "pt");
    			}

    			const tree_changes = {};
    			if (dirty & /*child_lines*/ 64) tree_changes.lines = /*child_lines*/ ctx[6];
    			if (dirty & /*depth*/ 4) tree_changes.depth = /*depth*/ ctx[2];
    			if (dirty & /*width*/ 1) tree_changes.width = /*width*/ ctx[0];

    			if (!updating_max_line_size && dirty & /*child_max_line_size*/ 16) {
    				updating_max_line_size = true;
    				tree_changes.max_line_size = /*child_max_line_size*/ ctx[4];
    				add_flush_callback(() => updating_max_line_size = false);
    			}

    			if (!updating_max_depth && dirty & /*child_max_depth*/ 32) {
    				updating_max_depth = true;
    				tree_changes.max_depth = /*child_max_depth*/ ctx[5];
    				add_flush_callback(() => updating_max_depth = false);
    			}

    			if (!updating_highlights && dirty & /*highlights*/ 2) {
    				updating_highlights = true;
    				tree_changes.highlights = /*highlights*/ ctx[1];
    				add_flush_callback(() => updating_highlights = false);
    			}

    			tree.$set(tree_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tree.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tree.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    			if (detaching) detach_dev(t);
    			destroy_component(tree, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(53:0) {#if child_lines && child_lines.length != 0}",
    		ctx
    	});

    	return block;
    }

    // (55:8) {#if line}
    function create_if_block_1$1(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*line*/ ctx[3].type == "p") return create_if_block_2;
    		if (/*line*/ ctx[3].type == "ne") return create_if_block_3;
    		if (/*line*/ ctx[3].type == "a") return create_if_block_4;
    		if (/*line*/ ctx[3].type == "b") return create_if_block_5;
    		if (/*line*/ ctx[3].type == "e") return create_if_block_6;
    		if (/*line*/ ctx[3].type == "o") return create_if_block_7;
    		if (/*line*/ ctx[3].type == "c") return create_if_block_8;
    		if (/*line*/ ctx[3].type == "br") return create_if_block_9;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
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
    		d: function destroy(detaching) {
    			if (if_block) {
    				if_block.d(detaching);
    			}

    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(55:8) {#if line}",
    		ctx
    	});

    	return block;
    }

    // (82:40) 
    function create_if_block_9(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[3].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t3;
    	let span2;
    	let t4_value = /*line*/ ctx[3].formula + "";
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
    			attr_dev(span0, "class", "ln svelte-dzbzd4");
    			add_location(span0, file$1, 82, 16, 3286);
    			attr_dev(span1, "class", "reason svelte-dzbzd4");
    			add_location(span1, file$1, 83, 16, 3337);
    			attr_dev(span2, "class", "formula svelte-dzbzd4");
    			add_location(span2, file$1, 84, 16, 3384);
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
    			if (dirty & /*line*/ 8 && t0_value !== (t0_value = /*line*/ ctx[3].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 8 && t4_value !== (t4_value = /*line*/ ctx[3].formula + "")) set_data_dev(t4, t4_value);
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
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(82:40) ",
    		ctx
    	});

    	return block;
    }

    // (79:39) 
    function create_if_block_8(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[3].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = /*line*/ ctx[3].src + "";
    	let t3;
    	let t4;
    	let t5_value = /*line*/ ctx[3].min_src + "";
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
    			attr_dev(span0, "class", "ln svelte-dzbzd4");
    			add_location(span0, file$1, 79, 16, 3119);
    			attr_dev(span1, "class", "reason svelte-dzbzd4");
    			add_location(span1, file$1, 80, 16, 3170);
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
    			if (dirty & /*line*/ 8 && t0_value !== (t0_value = /*line*/ ctx[3].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 8 && t3_value !== (t3_value = /*line*/ ctx[3].src + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 8 && t5_value !== (t5_value = /*line*/ ctx[3].min_src + "")) set_data_dev(t5, t5_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(79:39) ",
    		ctx
    	});

    	return block;
    }

    // (76:39) 
    function create_if_block_7(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[3].ln + "";
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
    			attr_dev(span0, "class", "ln svelte-dzbzd4");
    			add_location(span0, file$1, 76, 16, 2977);
    			attr_dev(span1, "class", "reason svelte-dzbzd4");
    			add_location(span1, file$1, 77, 16, 3028);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span0, anchor);
    			append_dev(span0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, span1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*line*/ 8 && t0_value !== (t0_value = /*line*/ ctx[3].ln + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(span1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(76:39) ",
    		ctx
    	});

    	return block;
    }

    // (72:39) 
    function create_if_block_6(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[3].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = (/*line*/ ctx[3].src, /*line*/ ctx[3].min_src) + "";
    	let t3;
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*line*/ ctx[3].formula + "";
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
    			attr_dev(span0, "class", "ln svelte-dzbzd4");
    			add_location(span0, file$1, 72, 16, 2749);
    			attr_dev(span1, "class", "reason svelte-dzbzd4");
    			add_location(span1, file$1, 73, 16, 2800);
    			attr_dev(span2, "class", "formula svelte-dzbzd4");
    			add_location(span2, file$1, 74, 16, 2875);
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
    			if (dirty & /*line*/ 8 && t0_value !== (t0_value = /*line*/ ctx[3].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 8 && t3_value !== (t3_value = (/*line*/ ctx[3].src, /*line*/ ctx[3].min_src) + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 8 && t6_value !== (t6_value = /*line*/ ctx[3].formula + "")) set_data_dev(t6, t6_value);
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
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(72:39) ",
    		ctx
    	});

    	return block;
    }

    // (68:39) 
    function create_if_block_5(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[3].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = (/*line*/ ctx[3].src, /*line*/ ctx[3].min_src) + "";
    	let t3;
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*line*/ ctx[3].formula + "";
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
    			attr_dev(span0, "class", "ln svelte-dzbzd4");
    			add_location(span0, file$1, 68, 16, 2521);
    			attr_dev(span1, "class", "reason svelte-dzbzd4");
    			add_location(span1, file$1, 69, 16, 2572);
    			attr_dev(span2, "class", "formula svelte-dzbzd4");
    			add_location(span2, file$1, 70, 16, 2647);
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
    			if (dirty & /*line*/ 8 && t0_value !== (t0_value = /*line*/ ctx[3].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 8 && t3_value !== (t3_value = (/*line*/ ctx[3].src, /*line*/ ctx[3].min_src) + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 8 && t6_value !== (t6_value = /*line*/ ctx[3].formula + "")) set_data_dev(t6, t6_value);
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
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(68:39) ",
    		ctx
    	});

    	return block;
    }

    // (64:39) 
    function create_if_block_4(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[3].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = /*line*/ ctx[3].src + "";
    	let t3;
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*line*/ ctx[3].formula + "";
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
    			attr_dev(span0, "class", "ln svelte-dzbzd4");
    			add_location(span0, file$1, 64, 16, 2309);
    			attr_dev(span1, "class", "reason svelte-dzbzd4");
    			add_location(span1, file$1, 65, 16, 2360);
    			attr_dev(span2, "class", "formula svelte-dzbzd4");
    			add_location(span2, file$1, 66, 16, 2419);
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
    			if (dirty & /*line*/ 8 && t0_value !== (t0_value = /*line*/ ctx[3].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 8 && t3_value !== (t3_value = /*line*/ ctx[3].src + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 8 && t6_value !== (t6_value = /*line*/ ctx[3].formula + "")) set_data_dev(t6, t6_value);
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
    		source: "(64:39) ",
    		ctx
    	});

    	return block;
    }

    // (60:40) 
    function create_if_block_3(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[3].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let t3_value = /*line*/ ctx[3].src + "";
    	let t3;
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*line*/ ctx[3].formula + "";
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
    			attr_dev(span0, "class", "ln svelte-dzbzd4");
    			add_location(span0, file$1, 60, 16, 2095);
    			attr_dev(span1, "class", "reason svelte-dzbzd4");
    			add_location(span1, file$1, 61, 16, 2146);
    			attr_dev(span2, "class", "formula svelte-dzbzd4");
    			add_location(span2, file$1, 62, 16, 2207);
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
    			if (dirty & /*line*/ 8 && t0_value !== (t0_value = /*line*/ ctx[3].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 8 && t3_value !== (t3_value = /*line*/ ctx[3].src + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*line*/ 8 && t6_value !== (t6_value = /*line*/ ctx[3].formula + "")) set_data_dev(t6, t6_value);
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
    		source: "(60:40) ",
    		ctx
    	});

    	return block;
    }

    // (56:12) {#if line.type == "p"}
    function create_if_block_2(ctx) {
    	let span0;
    	let t0_value = /*line*/ ctx[3].ln + "";
    	let t0;
    	let t1;
    	let span1;
    	let t3;
    	let span2;
    	let t4_value = /*line*/ ctx[3].formula + "";
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
    			attr_dev(span0, "class", "ln svelte-dzbzd4");
    			add_location(span0, file$1, 56, 16, 1894);
    			attr_dev(span1, "class", "reason svelte-dzbzd4");
    			add_location(span1, file$1, 57, 16, 1945);
    			attr_dev(span2, "class", "formula svelte-dzbzd4");
    			add_location(span2, file$1, 58, 16, 1992);
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
    			if (dirty & /*line*/ 8 && t0_value !== (t0_value = /*line*/ ctx[3].ln + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*line*/ 8 && t4_value !== (t4_value = /*line*/ ctx[3].formula + "")) set_data_dev(t4, t4_value);
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
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(56:12) {#if line.type == \\\"p\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$1, create_if_block_10];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*child_lines*/ ctx[6] && /*child_lines*/ ctx[6].length != 0) return 0;
    		if (/*line*/ ctx[3] && /*line*/ ctx[3].type == "bc") return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(target, anchor);
    			}

    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
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
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				} else {
    					if_block = null;
    				}
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
    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d(detaching);
    			}

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
    	let { depth } = $$props;
    	let { width } = $$props;
    	let { max_line_size } = $$props;
    	let { highlights } = $$props;
    	let { max_depth } = $$props;

    	// internal
    	let line, child_lines, line_number;

    	let line_size_char, line_size;
    	let child_max_line_size = 0;
    	let child_max_depth = 0;
    	const writable_props = ['lines', 'depth', 'width', 'max_line_size', 'highlights', 'max_depth'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Tree> was created with unknown prop '${key}'`);
    	});

    	function tree_max_line_size_binding(value) {
    		child_max_line_size = value;
    		$$invalidate(4, child_max_line_size);
    	}

    	function tree_max_depth_binding(value) {
    		child_max_depth = value;
    		$$invalidate(5, child_max_depth);
    	}

    	function tree_highlights_binding(value) {
    		highlights = value;
    		$$invalidate(1, highlights);
    	}

    	function tree0_max_line_size_binding(value) {
    		child_max_line_size = value;
    		$$invalidate(4, child_max_line_size);
    	}

    	function tree0_max_depth_binding(value) {
    		child_max_depth = value;
    		$$invalidate(5, child_max_depth);
    	}

    	function tree0_highlights_binding(value) {
    		highlights = value;
    		$$invalidate(1, highlights);
    	}

    	function tree1_max_line_size_binding(value) {
    		child_max_line_size = value;
    		$$invalidate(4, child_max_line_size);
    	}

    	function tree1_max_depth_binding(value) {
    		child_max_depth = value;
    		$$invalidate(5, child_max_depth);
    	}

    	function tree1_highlights_binding(value) {
    		highlights = value;
    		$$invalidate(1, highlights);
    	}

    	$$self.$$set = $$props => {
    		if ('lines' in $$props) $$invalidate(9, lines = $$props.lines);
    		if ('depth' in $$props) $$invalidate(2, depth = $$props.depth);
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('max_line_size' in $$props) $$invalidate(7, max_line_size = $$props.max_line_size);
    		if ('highlights' in $$props) $$invalidate(1, highlights = $$props.highlights);
    		if ('max_depth' in $$props) $$invalidate(8, max_depth = $$props.max_depth);
    	};

    	$$self.$capture_state = () => ({
    		lines,
    		depth,
    		width,
    		max_line_size,
    		highlights,
    		max_depth,
    		line,
    		child_lines,
    		line_number,
    		line_size_char,
    		line_size,
    		child_max_line_size,
    		child_max_depth
    	});

    	$$self.$inject_state = $$props => {
    		if ('lines' in $$props) $$invalidate(9, lines = $$props.lines);
    		if ('depth' in $$props) $$invalidate(2, depth = $$props.depth);
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('max_line_size' in $$props) $$invalidate(7, max_line_size = $$props.max_line_size);
    		if ('highlights' in $$props) $$invalidate(1, highlights = $$props.highlights);
    		if ('max_depth' in $$props) $$invalidate(8, max_depth = $$props.max_depth);
    		if ('line' in $$props) $$invalidate(3, line = $$props.line);
    		if ('child_lines' in $$props) $$invalidate(6, child_lines = $$props.child_lines);
    		if ('line_number' in $$props) line_number = $$props.line_number;
    		if ('line_size_char' in $$props) $$invalidate(10, line_size_char = $$props.line_size_char);
    		if ('line_size' in $$props) $$invalidate(11, line_size = $$props.line_size);
    		if ('child_max_line_size' in $$props) $$invalidate(4, child_max_line_size = $$props.child_max_line_size);
    		if ('child_max_depth' in $$props) $$invalidate(5, child_max_depth = $$props.child_max_depth);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*lines*/ 512) {
    			$$invalidate(3, line = lines ? lines[0] : undefined);
    		}

    		if ($$self.$$.dirty & /*lines*/ 512) {
    			$$invalidate(6, child_lines = lines ? lines.splice(1) : []);
    		}

    		if ($$self.$$.dirty & /*line*/ 8) {
    			line_number = line ? line.ln : 0;
    		}

    		if ($$self.$$.dirty & /*line*/ 8) {
    			$$invalidate(10, line_size_char = (line
    			? line.type == "p"
    				? `${line.ln} P ${line.formula}`
    				: line.type == "ne"
    					? `${line.ln} DNE(${line.src}) ${line.formula}`
    					: line.type == "a"
    						? `${line.ln} a(${line.src}) ${line.formula}`
    						: line.type == "b"
    							? `${line.ln} b{${line.src},${line.min_src}} ${line.formula}`
    							: line.type == "e"
    								? `${line.ln} e{${line.src},${line.min_src}} ${line.formula}`
    								: line.type == "o"
    									? `${line.ln} OPEN`
    									: line.type == "c"
    										? `${line.ln} X(${line.src},${line.min_src}) ${line.formula}`
    										: line.type == "br" ? `${line.ln} B ${line.formula}` : ""
    			: "").length);
    		}

    		if ($$self.$$.dirty & /*line_size_char*/ 1024) {
    			$$invalidate(11, line_size = line_size_char * 8.5);
    		}

    		if ($$self.$$.dirty & /*line_size, child_max_line_size*/ 2064) {
    			$$invalidate(7, max_line_size = line_size > child_max_line_size
    			? line_size
    			: child_max_line_size);
    		}

    		if ($$self.$$.dirty & /*max_line_size, width*/ 129) {
    			$$invalidate(0, width = max_line_size > width ? max_line_size : width);
    		}

    		if ($$self.$$.dirty & /*max_line_size, width*/ 129) {
    			console.log(max_line_size, width);
    		}

    		if ($$self.$$.dirty & /*depth, child_max_depth*/ 36) {
    			$$invalidate(8, max_depth = depth > child_max_depth ? depth : child_max_depth);
    		}
    	};

    	return [
    		width,
    		highlights,
    		depth,
    		line,
    		child_max_line_size,
    		child_max_depth,
    		child_lines,
    		max_line_size,
    		max_depth,
    		lines,
    		line_size_char,
    		line_size,
    		tree_max_line_size_binding,
    		tree_max_depth_binding,
    		tree_highlights_binding,
    		tree0_max_line_size_binding,
    		tree0_max_depth_binding,
    		tree0_highlights_binding,
    		tree1_max_line_size_binding,
    		tree1_max_depth_binding,
    		tree1_highlights_binding
    	];
    }

    class Tree extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			lines: 9,
    			depth: 2,
    			width: 0,
    			max_line_size: 7,
    			highlights: 1,
    			max_depth: 8
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tree",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*lines*/ ctx[9] === undefined && !('lines' in props)) {
    			console_1$1.warn("<Tree> was created without expected prop 'lines'");
    		}

    		if (/*depth*/ ctx[2] === undefined && !('depth' in props)) {
    			console_1$1.warn("<Tree> was created without expected prop 'depth'");
    		}

    		if (/*width*/ ctx[0] === undefined && !('width' in props)) {
    			console_1$1.warn("<Tree> was created without expected prop 'width'");
    		}

    		if (/*max_line_size*/ ctx[7] === undefined && !('max_line_size' in props)) {
    			console_1$1.warn("<Tree> was created without expected prop 'max_line_size'");
    		}

    		if (/*highlights*/ ctx[1] === undefined && !('highlights' in props)) {
    			console_1$1.warn("<Tree> was created without expected prop 'highlights'");
    		}

    		if (/*max_depth*/ ctx[8] === undefined && !('max_depth' in props)) {
    			console_1$1.warn("<Tree> was created without expected prop 'max_depth'");
    		}
    	}

    	get lines() {
    		throw new Error("<Tree>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lines(value) {
    		throw new Error("<Tree>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get depth() {
    		throw new Error("<Tree>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set depth(value) {
    		throw new Error("<Tree>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Tree>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Tree>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get max_line_size() {
    		throw new Error("<Tree>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set max_line_size(value) {
    		throw new Error("<Tree>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get highlights() {
    		throw new Error("<Tree>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set highlights(value) {
    		throw new Error("<Tree>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get max_depth() {
    		throw new Error("<Tree>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set max_depth(value) {
    		throw new Error("<Tree>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.44.3 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    // (30:22) 
    function create_if_block_1(ctx) {
    	let div;
    	let tree_1;
    	let updating_width;
    	let updating_max_depth;
    	let current;

    	function tree_1_width_binding(value) {
    		/*tree_1_width_binding*/ ctx[11](value);
    	}

    	function tree_1_max_depth_binding(value) {
    		/*tree_1_max_depth_binding*/ ctx[12](value);
    	}

    	let tree_1_props = {
    		highlights: [],
    		lines: /*tree*/ ctx[6],
    		depth: 0
    	};

    	if (/*width*/ ctx[1] !== void 0) {
    		tree_1_props.width = /*width*/ ctx[1];
    	}

    	if (/*max_depth*/ ctx[2] !== void 0) {
    		tree_1_props.max_depth = /*max_depth*/ ctx[2];
    	}

    	tree_1 = new Tree({ props: tree_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(tree_1, 'width', tree_1_width_binding));
    	binding_callbacks.push(() => bind(tree_1, 'max_depth', tree_1_max_depth_binding));

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(tree_1.$$.fragment);
    			attr_dev(div, "class", "tree-cont svelte-5c8gny");
    			set_style(div, "width", /*cont_width*/ ctx[0] + "pt");
    			add_location(div, file, 30, 2, 769);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(tree_1, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tree_1_changes = {};
    			if (dirty & /*tree*/ 64) tree_1_changes.lines = /*tree*/ ctx[6];

    			if (!updating_width && dirty & /*width*/ 2) {
    				updating_width = true;
    				tree_1_changes.width = /*width*/ ctx[1];
    				add_flush_callback(() => updating_width = false);
    			}

    			if (!updating_max_depth && dirty & /*max_depth*/ 4) {
    				updating_max_depth = true;
    				tree_1_changes.max_depth = /*max_depth*/ ctx[2];
    				add_flush_callback(() => updating_max_depth = false);
    			}

    			tree_1.$set(tree_1_changes);

    			if (!current || dirty & /*cont_width*/ 1) {
    				set_style(div, "width", /*cont_width*/ ctx[0] + "pt");
    			}
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
    		source: "(30:22) ",
    		ctx
    	});

    	return block;
    }

    // (28:1) {#if use_text}
    function create_if_block(ctx) {
    	let code;
    	let t;

    	const block = {
    		c: function create() {
    			code = element("code");
    			t = text(/*tree_text*/ ctx[5]);
    			attr_dev(code, "class", "svelte-5c8gny");
    			add_location(code, file, 28, 2, 719);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, code, anchor);
    			append_dev(code, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tree_text*/ 32) set_data_dev(t, /*tree_text*/ ctx[5]);
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
    		source: "(28:1) {#if use_text}",
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
    		/*search_check_binding*/ ctx[9](value);
    	}

    	function search_generate_binding(value) {
    		/*search_generate_binding*/ ctx[10](value);
    	}

    	let search_props = {};

    	if (/*try_get_header*/ ctx[4] !== void 0) {
    		search_props.check = /*try_get_header*/ ctx[4];
    	}

    	if (/*try_gen_tree*/ ctx[7] !== void 0) {
    		search_props.generate = /*try_gen_tree*/ ctx[7];
    	}

    	search = new Search({ props: search_props, $$inline: true });
    	binding_callbacks.push(() => bind(search, 'check', search_check_binding));
    	binding_callbacks.push(() => bind(search, 'generate', search_generate_binding));
    	const if_block_creators = [create_if_block, create_if_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*use_text*/ ctx[8]) return 0;
    		if (/*tree*/ ctx[6] != []) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text(/*header_text*/ ctx[3]);
    			t1 = space();
    			create_component(search.$$.fragment);
    			t2 = space();
    			if (if_block) if_block.c();
    			attr_dev(h1, "class", "svelte-5c8gny");
    			add_location(h1, file, 25, 1, 609);
    			attr_dev(main, "class", "svelte-5c8gny");
    			add_location(main, file, 24, 0, 601);
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
    			if (!current || dirty & /*header_text*/ 8) set_data_dev(t0, /*header_text*/ ctx[3]);
    			const search_changes = {};

    			if (!updating_check && dirty & /*try_get_header*/ 16) {
    				updating_check = true;
    				search_changes.check = /*try_get_header*/ ctx[4];
    				add_flush_callback(() => updating_check = false);
    			}

    			if (!updating_generate && dirty & /*try_gen_tree*/ 128) {
    				updating_generate = true;
    				search_changes.generate = /*try_gen_tree*/ ctx[7];
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
    		$$invalidate(3, header_text = solver.gen_interpretation(query));
    	};

    	let tree_text = "";
    	let use_text = false;

    	let try_gen_tree_text = query => {
    		$$invalidate(5, tree_text = solver.gen_text_tree(query));
    	};

    	let tree = [];

    	let try_gen_tree = query => {
    		$$invalidate(6, tree = JSON.parse(solver.gen_tree(query)));
    	};

    	let cont_width, width = 0, max_depth;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function search_check_binding(value) {
    		try_get_header = value;
    		$$invalidate(4, try_get_header);
    	}

    	function search_generate_binding(value) {
    		try_gen_tree = value;
    		$$invalidate(7, try_gen_tree);
    	}

    	function tree_1_width_binding(value) {
    		width = value;
    		$$invalidate(1, width);
    	}

    	function tree_1_max_depth_binding(value) {
    		max_depth = value;
    		$$invalidate(2, max_depth);
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
    		try_gen_tree,
    		cont_width,
    		width,
    		max_depth
    	});

    	$$self.$inject_state = $$props => {
    		if ('header_text' in $$props) $$invalidate(3, header_text = $$props.header_text);
    		if ('try_get_header' in $$props) $$invalidate(4, try_get_header = $$props.try_get_header);
    		if ('tree_text' in $$props) $$invalidate(5, tree_text = $$props.tree_text);
    		if ('use_text' in $$props) $$invalidate(8, use_text = $$props.use_text);
    		if ('try_gen_tree_text' in $$props) try_gen_tree_text = $$props.try_gen_tree_text;
    		if ('tree' in $$props) $$invalidate(6, tree = $$props.tree);
    		if ('try_gen_tree' in $$props) $$invalidate(7, try_gen_tree = $$props.try_gen_tree);
    		if ('cont_width' in $$props) $$invalidate(0, cont_width = $$props.cont_width);
    		if ('width' in $$props) $$invalidate(1, width = $$props.width);
    		if ('max_depth' in $$props) $$invalidate(2, max_depth = $$props.max_depth);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*width, max_depth*/ 6) {
    			$$invalidate(0, cont_width = width * (2 ^ max_depth));
    		}

    		if ($$self.$$.dirty & /*cont_width, width, max_depth*/ 7) {
    			console.log(cont_width, width, max_depth);
    		}
    	};

    	return [
    		cont_width,
    		width,
    		max_depth,
    		header_text,
    		try_get_header,
    		tree_text,
    		tree,
    		try_gen_tree,
    		use_text,
    		search_check_binding,
    		search_generate_binding,
    		tree_1_width_binding,
    		tree_1_max_depth_binding
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

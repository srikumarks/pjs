PJS
===
:author: Srikumar K. S.

PJS is a Forth-style language hosted on Javascript via an interpreter.
The intention is to help better scripting of interactions with the DOM
for UI creation purposes. Of course, it is also to play around with 
language construction for programming stuff.

**Status**: EVOLVING and for amusement.

Getting started
---------------

You'll need all the js files including ``pjs.js``. In your HTML, you
load up the ``pjs.js`` script and call its ``install`` function on the
``document`` object.

See the html files in the ``examples/`` folder for basic usage. You can start a
python server in the ``examples/`` folder and then go to
``http://localhost:8000/svg.html`` in your browser to view.

.. code-block:: html

   <script type="module" src="somewhere/pjs.js"></script>
   <script type="module">
        import {install} from "somewhere/pjs.js";
        install(document, ["weblang"])
    </script>

The second argument to ``install`` is an array of language modules.
Currently three are available -- ``"weblang", "svglang", "genailang"``.
If you leave out the second argument, all three languages are loaded up.
If you're doing web UI, you'll at least need the ``weblang`` loaded.

The above script should be the last within your ``body`` as is common
practice. You can include global scripts and element-wise scripts anywhere
else.

Global scripts are written like this --

.. code-block:: html

    <script type="text/f">
        ...your pjs code...
    </script>

Element-wise scripts are written like this --

.. code-block:: html

    <div f="text log">Hello world</div>

When such attached scripts are run, the "selection" is set to the element on
which they're running. For some elements, this means you can arrange for
special vocabulary to be available as well.

The above will print "Hello world" to the ``console.log``. The ``text`` word
will fetch the current selection's (i.e. the ``div``'s) text contents and place
it as a string on the stack. Then ``log`` will pick that up and show it on the
console.


Why PJS?
--------

The reason is simple - I've always had a soft spot for Forth and wanted to
be able to use it to express programs I need to write. However, the compiled
language is not what I want and I love the interactivity that Forth can enable.
So I wanted something like that for web UI scripting. 

PJS is a language experiment to overcome what I see as a structural limitation
in Forth - contextual vocabularies. So apart from the program stack and the
data stack, PJS introduces the notion of a "current selection". The object
that's currently selected can provide a vocabulary as long as it is current.
This is not necessarily "object oriented" in the sense that the target of those
words is that object, but that's left open for interpretation.

Syntax
------

PJS syntax is designed to be minimal, non-whitespace-sensitive. Here are **all**
of the syntax rules --

1. A script consists of "words" or bracket grouping expressions.

2. A "word" is a sequence of characters that are not whitespace, comma, semicolon,
   or brackets. Words may include the period character except at the end. If a period
   occurs at the end of a word, the period is treated as a separate word. Yes,
   you can use unicode characters as well. One of the motivations to using Forth is
   that the word ordering is slightly better aligned with Tamil than prefix
   function calling syntax.

3. A "word" is in effect a function that operates on the data stack and current selection
   and produces a result data stack. Most words operate on the top elements of the stack.
   Some words operate on the current selection.

3. ``{...}`` is a literal string.

4. ``[...]`` constructs an array whose contents are all the elements that the code
   within places on the stack.

5. ``(...)`` is an immediately executed code block that also serves as a scope for
   selections -- i.e. any changes to the "current selection" made within the group
   will revert upon exit.

6. ``(: ...)`` will construct a "block" and put it on the data stack.

7. Special word syntax - 

    a. ``:word`` will define a new word to be the block on top of the stack.
       Only blocks are permitted. No other values.

    b. ``:.word`` will define the word as vocabulary for the current selection.

    c. ``@word`` the current selection must be an element, this gets the attribute.

    d. ``@=word`` the current selection must be an element, this sets the attribute value.

    e. ``.varname`` will get the property of the currently selected object.

    f. ``.=varname`` will set the property of the currently selected object.

    g. ``~on<event>`` (ex: ``(: ...) ~onclick``) will add an event handler defined as a block
       to the currently selected object.

    h. ``#t #f`` - true and false literals.

8. Literal numbers (integer, floating point numbers) - these get pushed on to
   the stack immediately.

Basic vocabulary
----------------

1. ``dup`` - duplicates the top element of the stack (by reference).

2. ``swap`` - swaps the top two elements of the stack.

3. ``drop`` - drops the top element of the stack.

4. ``rot`` - brings the third element on the stack to the top.

5. ``+ - * / pow`` - binary math operators with the right operand being the stack top.
   *All* binary operators work as though the stack top were the RHS argument.

6. ``incr decr`` - increments/decrements the number on the stack top.

7. ``neg`` - negates the number on the stack top.

8. All unary functions in the Javascript ``Math`` object such as ``sin``,
   ``cos``, are available directly.

9. ``< <= > >= =`` - comparison operators that place a boolean on the stack
   as their result.

10. ``,`` - short circuiting conjunction (i.e. "and"). It will check the stack top.
    If it is ``#f``, it will exit the current code block. Otherwise, it will drop the
    boolean and continue.

11. ``;`` - short circuiting disjunction (i.e. "or"). It will check the stack top.
    If it is ``#t``, it will exit the current code block. Otherwise, it will
    drop the boolean and continue.

12. ``( <if> -> <then> ; <else> )`` behaves like you expect.

13. ``not`` - boolean not of stack top.

14. ``{propname} get`` - gets the named property of the object on the stack top.

15. ``<val> {propname} set`` - sets the named property of the object on the stack top.

16. ``[...] s`` - takes array of values on the stack top, stringifies them and concatenates
    them all and places the result string on the stack. If you use it as ``[...] {...} s``,
    then the given string on the stack top is used as a separator when joining.

17. ``&`` - takes the code block on the stack top and runs it asynchronously,
    continuing immediately with the rest of the program.

18. ``!`` - takes the code block on the stack top and runs it synchronously.

19. ``(... repeat)`` - do the current block again.

20. ``end`` - unconditionally exit the current block.

21. ``?end`` - exit the current block if the stack top is true.

22. ``log`` - prints the stack top to ``console.log`` and doesn't pop it off.

Running pjs programs
--------------------

.. code-block:: js

    export async function frun(programText, sel = null, langNames = kLangNames, refresh = false)

Parses and runs the given program text, with the given selection (which must be an array
of objects), the languages that need to be loaded, and whether they can
be loaded from the cache.

.. code-block:: js

    export async function install(document, langNames = kLangNames, refresh = false)

Searches for scripts with ``type="text/f"`` and runs them in order first.
Then searches for all DOM elements with the ``f=".."`` attribute set and runs
those programs with those corresponding elements as the context.

Creating a new language/vocabulary
----------------------------------

See ``weblang.js`` as an example. You need to create a module that exports the
``pslang`` symbol as a function with the signature ``function (defns, api)``
and which returns the ``defns`` argument after populating it with the vocabulary
of the language.

The ``api`` argument object will have the following functions defined -

1. ``forth(sel, pstack, dstack, defns)``
2. ``cons(car, cdr)``
3. ``empty()``
4. ``psProg(programText)``

The vocabulary is implemented typically as asynchronous functions 
that tail call the ``forth`` function to continue. They can also
be ordinary functions.

``pstack`` and ``dstack`` are both plain lists constructed using ``cons``
and ``empty``. The ``car`` and ``cdr`` of a list node can be accessed
using ``.car`` and ``.cdr``.

You usually won't need to modify the ``pstack`` when tail calling ``forth``,
but will have to drop appropriate number of elements from ``dstack`` by
doing ``dstack.cdr.cdr`` or something when tail calling ``forth``. See
the current language code for examples.





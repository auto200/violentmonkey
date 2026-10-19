I like the idea of local scripts. Would it be the best thing in the world for me? No. Would it be useful in some specific cases that I have? Sure.
I've done some digging and there are questions that we have to answer before

1. How does UserScript require local utilities?
    a. new metadata directive like `@require-utility` or `@require-local` eg. `// @require-utility localScriptName`
    b. extend current `@require` - `@require localScriptName` or `@require local localScriptName`

if in the future we were to add more script types eg. CSS, would we:
    a. add new metadata directive `@require-css`
    b. extend the `@require-local` eg. `@require-local localCSSScriptName`
    c. extend `@require` eg. `@require CSSScriptName` or `@require local-css CSSScriptName`

2. What is the order of scripts resolution?
    a. local scripts resolved first then remote
    b. remote scripts resolved first then local
    c. resolution based on order of directives in metadata template

3. Which [metadata directives](https://violentmonkey.github.io/api/metadata-block/) do local scripts support? 
I don't think directives like `@run-at` or `@match` make any sense. Also `@top-level-await` as it wraps the script in IIFE. We would have to define a full list of directives that we DO want to support.

4. Can local scripts include other scripts through `@require` or `@require-local`?
    a. no - for simplicity
    b. yes - we would need to guard against circular dependencies.

5. How are local scripts identified?
    AlttiRi proposed the local script specific `@require-id` directive. Which seems pretty reasonable. We would have to make sure that ids are unique across all local scripts and warn users on save if they are not. Also does sole presence of `@require-id` make a script local? Maybe it makes sense to introduce a new metadata template and discriminate script types by that.
    ```js
    // ==UtilityScript==
    // @name        New library script
    // @namespace   UtilityScripts
    // @version     1.0.0
    // @require-id  utils.common
    //
    // @description
    // ==/UtilityScript==
    ```

6. When editing the UserScript there is a "Settings" tab which shows the UserScript's specific fields as an UI elements and lets user edit them "easily". What should we show there when editing a local script?
    a. adjust the UI to show the local script specific fields
    b. hide the settings if it's a local script

## Other features that would make local scripts a first class citizen

7. When editing a local script there should be information about in which UserScript(s) it is currently used.

8. What happens when changing an id of a local script that is currently used in a UserScript(s)?
    a. we should warn the user that the change will break the UserScript(s)
    b. we should automatically update the id in the UserScript(s)

9. We should warn users when deleting a local script that is currently used in a UserScript(s)

10. Currently when editing a UserScript that `@require`s a remote script, a new tab appears that let's you view the remote script contents. We could use that tab to also show and let users edit local scripts directly from a UserScript. Same as in point (7) when editing a local script we should list all UserScript(s) that use it.

11. On the "Settings | backup" page similarly to "Custom Script Template" add "Local Script Template"/"Utility Script Template" that would be used when creating a new local script. And a new option to the add menu allowing for quick creation of a new local script.

12. Local script name autocomplete hint
    In https://github.com/violentmonkey/violentmonkey/pull/2708 we introduced some basic metadata directives autocomplete. We could extend it to hint local script names
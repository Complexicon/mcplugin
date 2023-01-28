This Repository contains the Source of the McPlugin tool.\
This Tool is an all-in-one build-system/debugger for Spigot Plugins!

## how does it work?
easy. we've had tools like vscode, maven and the redhat java extension for vscode for years now. but it doesn't integrate nicely with spigot plugins - this is where "mcplugin" comes in!

with it you can easily manage your plugin settings, minecraft version, debugging and more.
it nicely and quietly generates the correct configs for vscode, downloads and manages your maven dependencies, manages your different spigot versions in a central cache and last but not least: it does support debugging your plugin at runtime and hotreload on code change aswell!

## Usage

before usage you need to install it globally with npm e.g. `npm i -G mcplugin`

to create a project type `mcplugin init <version> <plugin-name> <your-group-id>`\
to rehydrate a cloned repo or to clean your repo type `mcplugin hydrate`\
to test without debugger type `mcplugin test`\
to build the plugin type `mcplugin build`

## the plug.conf.js
in this file your plugin parameters are set. for example maven dependencies or your minecraft version.\
after changes to this file you need to rehydrate your project in order to download all necessary dependencies. 

## the .plug folder
the .plug folder in your project contains your development server aswell as compiled java files (.class files) for makefile like behavior which only recompiles changed sources.\
it also contains your most recent "plugin.jar" a.k.a. your plugin

## the .plug_cache folder in your home folder
this folder contains all the different api jars, maven dependency jars, and spigot server jars to avoid having multiple copies of everything

## currently under construction
- automatic jdk detection (only works on windows currently. hold tight my fellow linux and mac users!)
- maven dependency system currently broken
- weird edge cases of minecraft version incompatabilities

## Thanks!
a big thank you goes out to the dev team of papermc, spigot and craftbukkit for providing such an awesome platform for creating minecraft plugins

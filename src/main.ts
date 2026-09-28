import { mount } from 'svelte'
import '@fontsource-variable/archivo'
import '@fontsource-variable/jetbrains-mono'
import './app.css'
import './lib/theme.svelte'
import App from './App.svelte'

export default mount(App, { target: document.getElementById('app')! })

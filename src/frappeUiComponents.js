import { Badge, Button, Combobox, DatePicker, Dialog, Dropdown, FeatherIcon, MultiSelect, TabButtons, Textarea, TextInput, TimePicker, Tooltip } from "frappe-ui";

// frappe-ui's FrappeUI plugin only installs resources/call/socket; it does NOT
// register components. An unregistered <Button> still renders (as a raw
// <button>, since HTML tags are case-insensitive) and <Badge> as an inert
// <badge> element, with no warning in a production build. Every frappe-ui
// component a template uses must be listed here; check_component_registry
// reads this map.
export const FRAPPE_UI_COMPONENTS = { Badge, Button, Combobox, DatePicker, Dialog, Dropdown, FeatherIcon, MultiSelect, TabButtons, Textarea, TextInput, TimePicker, Tooltip };

export function registerFrappeUIComponents(app) {
	for (const [name, component] of Object.entries(FRAPPE_UI_COMPONENTS)) app.component(name, component);
}

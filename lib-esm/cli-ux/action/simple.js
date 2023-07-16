import { ActionBase } from './base';
export default class SimpleAction extends ActionBase {
    type = 'simple';
    _start() {
        const task = this.task;
        if (!task)
            return;
        this._render(task.action, task.status);
    }
    _pause(icon) {
        if (icon)
            this._updateStatus(icon);
        else
            this._flush();
    }
    _resume() { }
    _updateStatus(status, prevStatus, newline = false) {
        const task = this.task;
        if (!task)
            return;
        if (task.active && !prevStatus)
            this._write(this.std, ` ${status}`);
        else
            this._write(this.std, `${task.action}... ${status}`);
        if (newline || !prevStatus)
            this._flush();
    }
    _stop(status) {
        const task = this.task;
        if (!task)
            return;
        this._updateStatus(status, task.status, true);
    }
    _render(action, status) {
        const task = this.task;
        if (!task)
            return;
        if (task.active)
            this._flush();
        this._write(this.std, status ? `${action}... ${status}` : `${action}...`);
    }
    _flush() {
        this._write(this.std, '\n');
        this._flushStdout();
    }
}

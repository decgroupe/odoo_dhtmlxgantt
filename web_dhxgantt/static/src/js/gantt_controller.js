odoo.define('web_dhxgantt.GanttController', function (require) {
    "use strict";

    // odoo/addons/web/static/src/js/views/basic/basic_controller.js
    var BasicController = require('web.BasicController');
    var core = require('web.core');
    var dialogs = require('web.view_dialogs');

    var _lt = core._lt;

    var GanttController = BasicController.extend({
        custom_events: _.extend({}, BasicController.prototype.custom_events, {
            gantt_data_updated: '_onGanttUpdated',
            gantt_create_dp: '_onGanttCreateDataProcessor',
            gantt_attach_events: '_onGanttAttachEvents',
            gantt_config: '_onGanttConfig',
            gantt_show_critical_path: '_onGanttShowCriticalPath',
            gantt_schedule: '_onGanttSchedule',
            gantt_reload: '_onGanttReload',
            gantt_drag_end: '_onGanttDragEnd',
        }),
        date_object: new Date(),
        init: function (parent, model, renderer, params) {
            // Ensure that id is properly defined, otherwise the model load
            // function does not return properly
            if (!(params && params.initialState && params.initialState.id)) {
                throw new Error("Model not loaded properly, missing 'initialState.id'");
            }
            this._super.apply(this, arguments);
        },
        getContext: function () {
            var context = this._super.apply(this, arguments);
            return context;
        },
        _onGanttCreateDataProcessor: function (event) {
            var self = this;
            if (this.dp_created) {
                return;
            }
            this.dp_created = true;
            var dp = gantt.createDataProcessor(function (entity, action, data, id) {
                switch (action) {
                    case "update":
                        return new gantt.Promise(function (resolve, reject) {
                            switch (entity) {
                                case "task":
                                    self.model.writeTask(data).then(function (ids) {
                                        self.model.reloadTaskDates(ids).then(function () {
                                            gantt.render();
                                        });
                                        resolve(true);
                                    }, function (res) {
                                        resolve({ state: "error" });
                                        self.update({});
                                    });
                                    break;
                            }
                        });
                    case "create":
                        return new gantt.Promise(function (resolve, reject) {
                            switch (entity) {
                                case "link":
                                    self.model.createLink(data).then(function (ids) {
                                        self.model.reloadTaskDates(ids).then(function () {
                                            gantt.render();
                                        });
                                        resolve(true);
                                    }, function (res) {
                                        resolve({ state: "error" });
                                        gantt.deleteLink(data.id);
                                    });
                                    break;
                            }
                        });
                    case "delete":
                        return new gantt.Promise(function (resolve, reject) {
                            switch (entity) {
                                case "link":
                                    self.model.deleteLink(data).then(function (res) {
                                        resolve(res);
                                    }, function (res) {
                                        resolve({ state: "error" });
                                        self.update({});
                                    });
                                    break;
                            }
                        });
                }
            });
            dp.attachEvent("onAfterUpdate", function (id, action, tid, response) {
                if (action == "error") {
                    // console.log('nice "an error occured :)"');
                } else {
                    // self.renderGantt();
                    return true;
                }
            });
            dp.attachEvent("onBeforeUpdate", function (id, state, data) {
                data.csrf_token = core.csrf_token;
                data.model_name = self.modelName;
                data.timezone_offset = (-self.date_object.getTimezoneOffset());
                return true;
            });
        },
        _onGanttAttachEvents: function (event) {
            var self = this;
            if (!self.events_set) {
                gantt.attachEvent("onBeforeTaskChanged", function (id, mode, task) {
                    // Copy current data as previous for next filtering
                    var task_ref = gantt.getTask(id);
                    task_ref.previous_start_date = task.start_date;
                    task_ref.previous_end_date = task.end_date;
                    task_ref.previous_duration = task.duration;
                    return true;
                });
                self.events_set = true;
            }
        },
        _onGanttUpdated: function (event) {
            event.stopPropagation();
            console.log('_onGanttUpdated');
        },
        _onGanttConfig: function () {
            var self = this;
            if (self.gantt_configured) {
                return;
            }
            self.gantt_configured = true;
            gantt.attachEvent('onBeforeLightbox', function (id) {
                // todo: Change this to trigger_up from renderer !!! to avoid errors
                var task = gantt.getTask(id);
                var title = _lt('Open: ') + task.text_leftside;
                if (self.form_dialog && !self.form_dialog.isDestroyed()) {
                    return false;
                }
                var session = self.getSession();
                var context = session ? session.user_context : {};
                var res_model = self.model.modelName;
                var res_id = task.id;
                if (task.overrideModelName) {
                    res_model = task.overrideModelName;
                }
                if (task.overrideModelId) {
                    res_id = task.overrideModelId;
                }
                if (task.isGroup) {
                    res_model = task.modelName;
                    res_id = task.modelId;
                } 
                if (res_model && res_id) {
                    self.form_dialog = new dialogs.FormViewDialog(self, {
                        res_model: res_model,
                        res_id: res_id,
                        context: context,
                        title: title,
                        // view_id: Number(this.open_popup_action),
                        on_saved: function (record, isChanged) {
                            self.write_completed(record, isChanged);
                        }
                    }).open();
                }
                return false; //return false to prevent showing the default form
            });
        },
        write_completed: function (record, isChanged) {
            if (isChanged) {
                var params = {
                    context: this.context,
                };
                this.update(params);
            }
        },
        _onGanttShowCriticalPath: function () {
            event.stopPropagation();
            var self = this;
            var def;

            if (self.criticalRendered) {
                self.criticalRendered = false;
                self.renderer.undoRenderCriticalTasks();
                return;
            }
            else {
                self.criticalRendered = true;
            }

            self._disableAllButtons();
            def = self.model.getCriticalPath().then(function (result) {
                self.renderer.renderCriticalTasks(result);
            });
            def.always(self._enableAllButtons.bind(self));
        },
        _disableAllButtons: function () {
            this.renderer.disableAllButtons();
        },
        _enableAllButtons: function () {
            this.renderer.enableAllButtons();
        },
        _onGanttSchedule: function () {
            var self = this;
            self.model.schedule().then(function () {
                self.update({ reload: true });
                self.renderer.renderGantt();
            });
        },
        _onGanttReload: function () {
            var self = this;
            self.update({ reload: true });
        },
        /**
         * todo
         *
         * @private
         * @param {OdooEvent} event
         */
        _onGanttDragEnd: function (event) {
            var self = this;
            if (event.data.tasksInRow.length === 1) {
                var task = event.data.tasksInRow[0];
                if (task.unscheduled) {
                    task.unscheduled = false;
                    var formatFunc = gantt.date.date_to_str("%d-%m-%Y %H:%i");
                    task.start_date = event.data.startDate;
                    task.end_date = event.data.endDate;
                    task.start_date = gantt.roundDate(task.start_date);
                    task.end_date = gantt.roundDate(task.end_date);
                    task.duration = gantt.calculateDuration(task);
                    self.model.writeTask({
                        id: task.id,
                        start_date: formatFunc(task.start_date),
                        end_date:  formatFunc(task.end_date),
                        duration: task.duration,
                    });
                    var scroll = gantt.getScrollState();
                    self.renderer.renderGantt();
                    gantt.scrollTo(scroll.x, scroll.y);
                    // TODO: select the newly created task to force view focus
                    // on, because when the horizontal or vertical scrollbar is
                    // active, the gantt rendering reset its position
                }
            }
        },
    });
    return GanttController;

});
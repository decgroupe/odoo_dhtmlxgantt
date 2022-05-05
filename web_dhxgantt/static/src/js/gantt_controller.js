odoo.define('web_dhxgantt.GanttController', function (require) {
    "use strict";

    // odoo/addons/web/static/src/js/views/basic/basic_controller.js
    var BasicController = require('web.BasicController');
    var config = require('web.config');
    var core = require('web.core');
    var dialogs = require('web.view_dialogs');

    var _lt = core._lt;
    var QWeb = core.qweb;

    var GanttController = BasicController.extend({
        custom_events: _.extend({}, BasicController.prototype.custom_events, {
            gantt_data_updated: '_onGanttUpdated',
            gantt_create_dataprocessor: '_onGanttCreateDataProcessor',
            gantt_attach_events: '_onGanttAttachEvents',
            gantt_edit_form: '_onGanttEditForm',
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
            this.formViewId = params.formViewId;
        },

        getContext: function () {
            var context = this._super.apply(this, arguments);
            return context;
        },

        /**
         * Render the buttons according to the web_dhxgantt.buttons template and
         * add listeners on it. Set this.$buttons with the produced jQuery element
         *
         * @param {jQueryElement} [$node] a jQuery node where the rendered buttons
         *   should be inserted. $node may be undefined, in which case the Gantt
         *   inserts them into this.options.$buttons or into a div of its template
         */
        renderButtons: function ($node) {
            var self = this;
            this.$buttons = $(QWeb.render('web_dhxgantt.buttons', {
                isMobile: config.device.isMobile,
            }));

            self.$buttons.on('click', '.o_dhx_zoom_out', function () {
                gantt.ext.zoom.zoomOut();
                self.renderer._updateIgnoreTime();
                gantt.render();
            });

            self.$buttons.on('click', '.o_dhx_zoom_in', function () {
                gantt.ext.zoom.zoomIn();
                self.renderer._updateIgnoreTime();
                gantt.render();
            });

            self.$buttons.on('click', '.o_dhx_fullscreen', function () {
                if (!gantt.getState().fullscreen) {
                    // expanding the gantt to full screen
                    gantt.expand();
                }
                else {
                    // collapsing the gantt to the normal mode
                    gantt.collapse();
                }
            });

            self.$buttons.on('click', '.o_dhx_show_all', function () {
                self.renderer.showOnlyWorkdays = false;
                self.renderer.showOnlyOfficeHours = false;
                self.renderer._updateIgnoreTime();
                gantt.render();
                self._updateButtonState();
            });

            self.$buttons.on('click', '.o_dhx_show_workdays', function () {
                self.renderer.showOnlyWorkdays = !self.renderer.showOnlyWorkdays;
                gantt.ext.zoom.setLevel("week");
                self.renderer._updateIgnoreTime();
                gantt.render();
                self._updateButtonState();
            });


            self.$buttons.on('click', '.o_dhx_show_officehours', function () {
                self.renderer.showOnlyOfficeHours = !self.renderer.showOnlyOfficeHours;
                gantt.ext.zoom.setLevel("hour");
                self.renderer._updateIgnoreTime();
                gantt.render();
                self._updateButtonState();
            });

            if ($node) {
                self.$buttons.appendTo($node);
            } else {
                self.$('.o_dhx_buttons').replaceWith(this.$buttons);
            }
            
            self._updateButtonState();
        },

        _updateButtonState: function () {
            var self = this;

            self.$buttons.find('.active').removeClass('active');
            if (self.renderer.showOnlyOfficeHours) {
                self.$buttons.find('.o_dhx_show_officehours').addClass('active');
            }
            if (self.renderer.showOnlyWorkdays) {
                self.$buttons.find('.o_dhx_show_workdays').addClass('active');
            }

        },

        /**
         * This is the main entry point for the controller. 
         * 
         * Note the first update is not made here but from the 
         * controller `start` method
         * 
         * Changes from the search view arrive in this method, and internal
         * changes can sometimes also call this method.  It is basically the
         * way everything notifies the controller that something has changed.
         *
         * The update method is responsible for fetching necessary data, then
         * updating the renderer and wait for the rendering to complete.
         * 
         * @param {Object} params will be given to the model and to the renderer
         * @param {Object} [options]
         * @param {boolean} [options.reload=true] if true, the model will reload data
         *
         * @returns {Deferred}
         */
        update: function (params, options) {
            var self = this;
            // self._updateButtons();
            // TODO: Recreate gantt Data
            var parentUpdateResult = self._super.apply(self, arguments);
            return parentUpdateResult;
        },

        /**
         * This method is called after each update or when the start method is
         * completed.
         *
         * Its primary use is to be used as a hook to update all parts of the UI,
         * besides the renderer.  For example, it may be used to enable/disable
         * some buttons in the control panel, such as the current graph type for a
         * graph view.
         *
         * @private
         * @param {Object} state the state given by the model
         * @returns {Deferred}
         */
        _update: function (state) {
            var self = this;
            return self._super.apply(self, arguments);
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

        _getGanttItemDialogActionParams: function (ganttItem, dataPoint, parentDataPoint, options) {
            var params = {
                res_model: false,
                res_id: false,
                view_id: false,
            };

            if (ganttItem.isGroup) {
                var groupedByField = parentDataPoint.groupedBy[0];
                var field = parentDataPoint.fields[groupedByField];
                if (field && field.relation) {
                    params.res_model = field.relation;
                    params.res_id = dataPoint.res_id;
                }
            } else {
                params.res_model = dataPoint.model;
                params.res_id = dataPoint.data.id;
                params.view_id = this.formViewId || false;
            }

            return params;
        },

        _onGanttEditForm: function (event) {
            var self = this;
            var options = event.data.options ? event.data.options : {};
            var item = gantt.getTask(event.data.id);
            var title = _lt('Open: ') + item.textLeftSide;
            if (self.form_dialog && !self.form_dialog.isDestroyed()) {
                return false;
            }
            var session = self.getSession();
            var context = session ? session.user_context : {};

            var dataPoint = self.model.get(item.id);
            var parentDataPoint = self.model.get(item.parentId);
            var dialogParams = self._getGanttItemDialogActionParams(item, dataPoint, parentDataPoint, options);

            if (dialogParams.res_model && dialogParams.res_id) {
                self.form_dialog = new dialogs.FormViewDialog(self, {
                    res_model: dialogParams.res_model,
                    res_id: dialogParams.res_id,
                    context: context,
                    title: title,
                    view_id: dialogParams.view_id,
                    on_saved: function (record, isChanged) {
                        self._onFormSaved(record, isChanged);
                    }
                }).open();
            }
            return false; //return false to prevent showing the default form
        },

        _onFormSaved: function (record, isChanged) {
            if (isChanged) {
                var params = {
                    context: this.context,
                };
                this.update(params);
            }
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
                        end_date: formatFunc(task.end_date),
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
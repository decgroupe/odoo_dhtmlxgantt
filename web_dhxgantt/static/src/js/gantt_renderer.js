odoo.define('web_dhxgantt.GanttRenderer', function (require) {
    "use strict";

    // odoo/addons/web/static/src/js/views/basic/basic_renderer.js
    var BasicRenderer = require('web.BasicRenderer');
    var session = require('web.session');
    var core = require('web.core');

    var _lt = core._lt;

    var GanttRenderer = BasicRenderer.extend({
        template: "web_dhxgantt.gantt_view",
        date_object: new Date(),
        events: _.extend({}, BasicRenderer.prototype.events, {
            'click button.o_dhx_critical_path': '_onClickCriticalPath',
            'click button.o_dhx_reschedule': '_onClickReschedule',
            'click button.o_dhx_show_all': '_onClickShowAll',
            'click button.o_dhx_show_workdays': '_onClickShowWorkdays',
            'click button.o_dhx_show_officehours': '_onClickShowOfficeHours',
            'click button.o_dhx_zoom_in': '_onClickZoomIn',
            'click button.o_dhx_zoom_out': '_onClickZoomOut',
            'click button.o_dhx_fullscreen': '_onClickFullscreen',
        }),
        init: function (parent, state, params) {
            this._super.apply(this, arguments);
            var self = this;

            // Set by `on_attach_callback` and unset by `on_detach_callback`
            // to ensure that gantt rendering is done when the DOM is ready.
            this._isInDom = false;

            self.modelName = params.modelName;
            self.fieldsViewInfo = params.fieldsViewInfo;

            self.fieldsMapping = params.fieldsMapping;
            self.parentFieldsMapping = params.parentFieldsMapping;

            self.hoursPerDay = 7;
            self.showOnlyWorkdays = true;
            self.showOnlyOfficeHours = true;

            gantt.config.row_height = 24;
            gantt.config.task_height_offset = 0.1;
            gantt.config.min_column_width = 20;
            gantt.config.work_time = true;
            gantt.config.skip_off_time = false;
            gantt.config.drag_progress = params.drag_progress;
            gantt.config.drag_project = true;
            gantt.config.show_links = true;
            gantt.config.drag_links = false;

            var renderColumnTitle = function (task) {
                // TODO: add image when available (current user)
                return task.columnTitle;
            };

            // https://docs.dhtmlx.com/gantt/desktop__specifying_columns.html
            // Note that `resize` with `config.grid_resize` is a PRO edition
            // functionality
            gantt.config.columns = [
                // {name: "wbs", label: "WBS", width: 40, template: gantt.getWBSCode},
                {
                    name: "columnTitle", label: "Title", tree: true, width: 320, min_width: 110,
                    template: renderColumnTitle,
                },
                { name: "textRightside", label: "Assign.", align: "left", width: 120 },
                { name: "dateDeadline", label: "Limit", align: "center", width: 80, resize: true },
            ]
            gantt.config.layout = {
                css: "gantt_container",
                cols: [
                    {
                        width: 520,
                        // adding horizontal scrollbar to the grid via 
                        // the scrollX attribute
                        rows: [
                            {
                                view: "grid",
                                scrollX: "gridScroll",
                                scrollable: true,
                                scrollY: "scrollVer"
                            },
                            {
                                view: "scrollbar",
                                id: "gridScroll"
                            }
                        ]
                    },
                    // { resizer: true, width: 1 },
                    {
                        rows: [
                            {
                                view: "timeline",
                                scrollX: "scrollHor",
                                scrollY: "scrollVer"
                            },
                            {
                                view: "scrollbar",
                                id: "scrollHor"
                            }
                        ]
                    },
                    {
                        view: "scrollbar",
                        id: "scrollVer"
                    }
                ]
            };

            var zoomConfig = {
                maxColumnWidth: 50,
                levels: [
                    // hours
                    {
                        name: "hour",
                        scale_height: 50,
                        min_column_width: 40,
                        scales: [
                            {
                                unit: "day", step: 1, format: "%d %M", css: function (date) {
                                    if (!gantt.isWorkTime({ date: date, unit: "day" })) {
                                        return "o_dhx_gantt_weekend"
                                    }
                                }
                            },
                            {
                                unit: "hour", step: 1, format: "%H", css: function (date) {
                                    if (!gantt.isWorkTime({ date: date, unit: "hour" })) {
                                        return "o_dhx_gantt_hourleaves"
                                    }
                                }
                            },
                        ]
                    },
                    // days
                    {
                        name: "day",
                        scale_height: 50,
                        min_column_width: 60,
                        scales: [
                            {
                                unit: "month", step: 1, format: "%M", css: function (date) {
                                    return "";
                                },
                            },
                            {
                                unit: "day", step: 1, format: "%j %D", css: function (date) {
                                    if (!gantt.isWorkTime({ date: date, unit: "day" })) {
                                        return "o_dhx_gantt_weekend"
                                    }
                                }
                            },
                        ]
                    },
                    // weeks
                    {
                        name: "week",
                        scale_height: 50,
                        min_column_width: 40,
                        scales: [
                            {
                                unit: "week", step: 1, format: function (date) {
                                    var month = gantt.date.date_to_str("%M")(date);
                                    var week = gantt.date.date_to_str("%W")(date);
                                    return month + " (" + _lt("Week#") + week + ")";
                                }
                            },
                            {
                                unit: "day", step: 1, format: "%d", css: function (date) {
                                    if (!gantt.isWorkTime({ date: date, unit: "day" })) {
                                        return "o_dhx_gantt_weekend"
                                    }
                                }
                            }
                        ]
                    },
                    // months
                    {
                        name: "month",
                        scale_height: 50,
                        min_column_width: 120,
                        scales: [
                            { unit: "month", format: "%F, %Y" },
                            {
                                unit: "week", format: function (date) {
                                    var dateToStr = gantt.date.date_to_str("%W")(date);
                                    return _lt("Week") + " " + dateToStr;
                                }
                            }
                        ]
                    },
                    // quarters
                    {
                        name: "quarter",
                        height: 50,
                        min_column_width: 90,
                        scales: [
                            { unit: "month", step: 1, format: "%M" },
                            {
                                unit: "quarter", step: 1, format: function (date) {
                                    var dateToStr = gantt.date.date_to_str("%M");
                                    var endDate = gantt.date.add(gantt.date.add(date, 3, "month"), -1, "day");
                                    return dateToStr(date) + " - " + dateToStr(endDate);
                                }
                            }
                        ]
                    },
                    // years
                    {
                        name: "year",
                        scale_height: 50,
                        min_column_width: 30,
                        scales: [
                            { unit: "year", step: 1, format: "%Y" }
                        ]
                    }
                ],
                // https://docs.dhtmlx.com/gantt/samples/03_scales/14_scale_zoom_by_wheelmouse.html
                useKey: "ctrlKey",
                trigger: "wheel",
                element: function () {
                    return gantt.$root.querySelector(".gantt_task");
                }
            };
            gantt.ext.zoom.init(zoomConfig);
            gantt.ext.zoom.setLevel("week");

            // TODO: make this read from some database variable
            gantt.setWorkTime({ day: 6, hours: false });
            gantt.setWorkTime({ day: 7, hours: false });
            gantt.setWorkTime({ hours: ["8:30-12:00", "13:30-17:00"] }); //global working hours

            gantt.templates.task_class = function (start, end, task) {
                return task.cssClass;
            };

            gantt.templates.grid_row_class = function (start, end, task) {
                return task.cssClass;
            };

            gantt.templates.task_row_class = function (start, end, task) {
                return "";
            };

            gantt.templates.task_text = function (start, end, task) {
                var res = [];
                if (task.type == gantt.config.types.task) {
                    if (session.debug) {
                        res.push(`(ID: #${task.id})`);
                    }
                }
                if (task.text) {
                    res.push(task.text);
                }
                return res.join("<br/>");
            };

            gantt.templates.leftside_text = function (start, end, task) {
                if (task.type == gantt.config.types.task && task.text_leftside) {
                    return task.text_leftside;
                }
            };

            // https://docs.dhtmlx.com/gantt/api__gantt_rightside_text_template.html
            // specifies the text assigned to tasks bars on the right side
            gantt.templates.rightside_text = function (start, end, task) {
                var duration = task.duration;
                if (gantt.config.duration_unit == "day") {
                    duration = duration * 60 * self.hoursPerDay;
                }
                var days = Math.floor(duration / self.hoursPerDay / 60);
                var hours = Math.floor(duration / 60 % self.hoursPerDay);
                var minutes = Math.round(duration % 60);

                var res = "";
                if (days > 0) {
                    res += " " + days + _lt(" day(s)");
                }
                if (hours > 0) {
                    res += " " + hours + _lt(" hour(s)");
                }
                if (minutes > 0) {
                    res += " " + minutes + _lt(" minute(s)");
                }
                if (task.text_rightside) {
                    res += " " + task.text_rightside
                }
                return res.trim();
            };

            gantt.templates.progress_text = function (start, end, task) {
                // TODO: Replace style with a css class
                return "<span style='text-align:left; display:inline-block; width:90%;'>" + Math.round(task.progress * 100) + "% </span>";
            };

            gantt.templates.tooltip_text = function (start, end, item) {
                // console.log(self.state.fields);
                if (item.type == gantt.config.types.task) {
                    self.renderItemTooltip(
                        item,
                        gantt.templates.tooltip_date_format(start),
                        gantt.templates.tooltip_date_format(end)
                    );
                } else {
                    return "";
                };
            }

            this._updateIgnoreTime();

            /*
                        // TODO: make this read from some database variable
                        // https://docs.dhtmlx.com/gantt/api__gantt_scale_cell_class_template.html
                        gantt.templates.scale_cell_class = function (date) {
                            if (!gantt.isWorkTime(date)) {
                                return "o_dhx_gantt_weekend";
                            }
                        };
            
                        // TODO: make this read from some database variable
                        gantt.templates.timeline_cell_class = function (task, date) {
                            // if (gantt.ignore_time && gantt.ignore_time(date)) {
                            //     return "o_dhx_gantt_weekend";
                            // }
                        };
            */
        },
        /**
         * @override
         */
        start: function () {
            var self = this;
            self.updateGanttState(self.state);
            return this._super.apply(this, arguments);
        },
        _updateIgnoreTime: function (level) {

            var self = this;
            if (level == null) {
                level = gantt.ext.zoom.getCurrentLevel();
            }

            var hour = gantt.ext.zoom._getZoomIndexByName("hour")
            var day = gantt.ext.zoom._getZoomIndexByName("day")
            var week = gantt.ext.zoom._getZoomIndexByName("week")
            var month = gantt.ext.zoom._getZoomIndexByName("month")
            var quarter = gantt.ext.zoom._getZoomIndexByName("quarter")
            var year = gantt.ext.zoom._getZoomIndexByName("year")

            // https://docs.dhtmlx.com/gantt/api__gantt_duration_unit_config.html
            var duration_unit = gantt.config.duration_unit;
            var ratio = 1;
            var mode = "";
            if (level == hour) {
                gantt.config.duration_unit = "minute";
                gantt.config.duration_step = 1;
                if (duration_unit == "day") {
                    mode = "multiply";
                    ratio = 60 * self.hoursPerDay;
                }
            } else {
                gantt.config.duration_unit = "day";
                gantt.config.duration_step = 1;
                if (duration_unit == "minute") {
                    mode = "divide";
                    ratio = 60 * self.hoursPerDay;
                }
            }
            // Update duration to reflect new `duration_unit`
            if (ratio != 1) {
                for (const [id, task] of Object.entries(gantt.$data.tasksStore.pull)) {
                    if (mode == "multiply") {
                        task.duration = task.duration * ratio;
                    } else if (mode == "divide") {
                        task.duration = task.duration / ratio;
                    };
                }
            }

            // https://docs.dhtmlx.com/gantt/api__gantt_time_step_config.html
            // sets the minimum step (in minutes) for the task's time values
            if (level == hour) {
                gantt.config.time_step = 30;
            } else {
                gantt.config.time_step = 60;
            }
            // https://docs.dhtmlx.com/gantt/api__gantt_round_dnd_dates_config.html
            // enables rounding the task's start and end dates to the nearest scale marks
            gantt.config.round_dnd_dates = (level != hour);

            if (level == hour) {
                gantt.ignore_time = function (date) {
                    var res = true;
                    if (self.showOnlyOfficeHours) {
                        res = gantt.isWorkTime(date, "hour");
                    }
                    return !res;
                }
            } else if (level == day || level == week || level == month) {
                gantt.ignore_time = function (date) {
                    var res = true;
                    if (self.showOnlyWorkdays) {
                        res = gantt.isWorkTime(date, "day");
                    }
                    return !res;
                }
            } else if (level == quarter || level == year) {
                gantt.ignore_time = null;
            } else {
                gantt.ignore_time = null;
            }

        },
        _onClickCriticalPath: function () {
            this.trigger_up('gantt_show_critical_path');
        },
        _onClickReschedule: function () {
            this.trigger_up('gantt_schedule');
        },
        _onClickShowAll: function () {
            this.showOnlyWorkdays = false;
            this.showOnlyOfficeHours = false;
            this._updateIgnoreTime();
            gantt.render();
        },
        _onClickShowWorkdays: function () {
            this.showOnlyWorkdays = true;
            gantt.ext.zoom.setLevel("week");
            this._updateIgnoreTime();
            gantt.render();
        },
        _onClickShowOfficeHours: function () {
            this.showOnlyOfficeHours = true;
            gantt.ext.zoom.setLevel("hour");
            this._updateIgnoreTime();
            gantt.render();
        },
        _onClickZoomIn: function () {
            gantt.ext.zoom.zoomIn();
            this._updateIgnoreTime();
            gantt.render();
        },
        _onClickZoomOut: function () {
            gantt.ext.zoom.zoomOut();
            this._updateIgnoreTime();
            gantt.render();
        },
        _onClickFullscreen: function () {
            if (!gantt.getState().fullscreen) {
                // expanding the gantt to full screen
                gantt.expand();
            }
            else {
                // collapsing the gantt to the normal mode
                gantt.collapse();
            }
        },
        /**
         * Called each time the renderer is attached into the DOM.
         */
        on_attach_callback: function () {
            this._isInDom = true;
            this.renderGantt();
        },
        /**
         * Called each time the renderer is detached from the DOM.
         */
        on_detach_callback: function () {
            this._isInDom = false;
        },
        /**
         * Main entry point for the rendering.
         * @private
         * @override method from BasicRenderer
         * @returns {Deferred}
         */
        _renderView: function () {
            var self = this;
            var res = this._super.apply(this, arguments);
            var isGrouped = !!this.state.groupedBy.length;
            res.then(function () {
                if (self._isInDom) {
                    self.renderGantt();
                }
            });
            return res;
        },
        renderItemTooltip: function (item, start, end) {
            var res = []
            if (item.textLeftSide) {
                res.push(item.textLeftSide);
            }
            if (item.textRightside) {
                res.push(item.textRightside);
            }
            res.push("<b>" + _lt("Start date:") + "</b> " + start);
            res.push("<b>" + _lt("End date:") + "</b> " + end);
            if (item.text) {
                res.push(item.text);
            }
            return res.join("<br/>");
        },
        renderGantt: function () {
            var self = this;
            var gantt_root = this.$('.o_dhx_gantt_root').get(0);
            var gantt_container = this.$('.o_dhx_gantt').get(0);
            // Selector is not finding the `gantt_root` ! don't know why ...
            if (!gantt_root) {
                gantt_root = gantt_container.parentElement;
            }
            // https://docs.dhtmlx.com/gantt/desktop__extensions_list.html
            gantt.plugins({
                // https://docs.dhtmlx.com/gantt/desktop__markers.html
                marker: true,
                // https://docs.dhtmlx.com/gantt/api__gantt_drag_timeline_config.html
                drag_timeline: true,
                // https://docs.dhtmlx.com/gantt/desktop__multiselection.html
                multiselect: true,
                // https://docs.dhtmlx.com/gantt/desktop__quick_info.html
                quick_info: false,
                //https://docs.dhtmlx.com/gantt/desktop__tooltips.html
                tooltip: true,
                // https://docs.dhtmlx.com/gantt/desktop__fullscreen_mode.html
                fullscreen: true,
                // https://docs.dhtmlx.com/gantt/desktop__extensions_list.html#advanceddragndrop
                click_drag: true,
            });
            this.trigger_up('gantt_config');
            this.trigger_up('gantt_create_dp');
            this.trigger_up('gantt_attach_events');
            if (!this.events_set) {
                gantt.attachEvent('onBeforeGanttRender', function () {
                    var rootHeight = self.$el.height();
                    var headerHeight = self.$('.o_dhx_gantt_header').height();
                    self.$('.o_dhx_gantt').height(rootHeight - headerHeight);
                });
                gantt.attachEvent('onClearAll', function () {
                    console.log("onClearAll", arguments);
                });
                gantt.attachEvent('onTaskCreated', function (item) {
                    console.log("onTaskCreated", item);
                });
                gantt.attachEvent('onAfterUpdate', function () {
                    console.log("onAfterUpdate", arguments);
                });
                gantt.attachEvent('onBeforeUpdate', function () {
                    console.log("onBeforeUpdate", arguments);
                });
                gantt.attachEvent('onParse', function () {
                    console.log("onParse", arguments);
                });
                gantt.attachEvent('onBeforeParse', function () {
                    console.log("onBeforeParse", arguments);
                });
                gantt.attachEvent('onAfterAdd', function () {
                    console.log("onAfterAdd", arguments);
                });
                gantt.attachEvent('onDestroy', function () {
                    console.log("onDestroy", arguments);
                });
                gantt.attachEvent('onClear', function () {
                    console.log("onClear", arguments);
                });
                gantt.attachEvent('onDataRender', function () {
                    console.log("onDataRender", arguments);
                });
                gantt.attachEvent('onGanttReady', function () {
                    console.log("onGanttReady", arguments);
                });
                gantt.attachEvent('onTemplatesReady', function () {
                    console.log("onTemplatesReady", arguments);
                });
                gantt.attachEvent('onReady', function () {
                    console.log("onReady", arguments);
                });
                gantt.attachEvent('onScroll', function () {
                    console.log("onScroll", arguments);
                });
                gantt.attachEvent('onGanttScroll', function () {
                    console.log("onGanttScroll", arguments);
                });
                this.events_set = true;
            }
            // We don't need to call `gantt.clearAll()` since the future
            // `init` and `parse` already do it

            // Configure `marker` plugin
            var date_to_str = gantt.date.date_to_str(gantt.config.task_date);
            gantt.addMarker({
                start_date: new Date(), //a Date object that sets the marker's date
                css: "today", //a CSS class applied to the marker
                text: _lt("Today"), //the marker title
                title: date_to_str(new Date()) // the marker's tooltip
            });
            var rootHeight = this.$el.height();
            var headerHeight = this.$('.o_dhx_gantt_header').height();
            this.$('.o_dhx_gantt').height(rootHeight - headerHeight);

            // Configure `drag_timeline` plugin
            gantt.config.drag_timeline = {
                ignore: ".gantt_task_line, .gantt_task_link",
                useKey: "shiftKey",
            };

            // Configure `click_drag` plugin
            gantt.config.click_drag = {
                callback: onDragEnd,
                singleRow: true,
                useKey: "ctrlKey",
            };
            // Define the standard callback way then redirect to controller
            function onDragEnd(startPoint, endPoint, startDate, endDate, tasksBetweenDates, tasksInRow) {
                self.trigger_up('gantt_drag_end', {
                    startDate: startDate,
                    endDate: endDate,
                    tasksInRow: tasksInRow,
                });
            };

            // Configure `fullscreen` plugin
            gantt.ext.fullscreen.getFullscreenElement = function () {
                return gantt_root;
            }

            // Set locale (lang) from current user settings
            var context = this.getSession().user_context;
            var locale = context.lang.substring(0, 2) || 'en_US';
            gantt.i18n.setLocale(locale);

            gantt.init(gantt_container);

            if (this.state.ganttDataFull && this.state.ganttDataFull.items) {
                // self.state.ganttDataFull.items.forEach(function (item) {
                //     item.color = "";
                // });
                // The library needs data in a `tasks` variable so we just create
                // a reference on it (not a copy).
                this.state.ganttDataFull.tasks = this.state.ganttDataFull.items;
                // The `parse` method will operate a `gantt.render()`
                gantt.parse(this.state.ganttDataFull);
            }
        },

        /**
         * This method is called by the controller when the search view is
         * changed.
         * Defined in `odoo/addons/web/static/src/js/views/abstract_renderer.js`
         *
         * @param {Object} state
         * @param {Object} params
         */
        updateState: function (state, params) {
            var self = this;
            self.updateGanttState(state, params);
            // The `super` call will do a `_render` and  `_renderView` so we
            // don't need to call `renderGantt` here.
            var res = self._super.apply(self, arguments);
            self.isGrouped = state.groupedBy.length > 0;
            return res;
        },
        updateGanttState: function (state, params) {
            var self = this;
            gantt.clearAll();
            self.cssClasses = [];
            state.ganttDataFull = {
                items: [],
                links: [],
            };
            self.createGanttGroupsAndItems(state, state);
        },
        createGanttGroupsAndItems: function (rootState, parentState) {
            var self = this;

            // Create groups first
            var dataGroups = parentState.data.filter(function (dataPoint) {
                return dataPoint.type === "list";
            });
            dataGroups.forEach(function (dataPoint) {
                var group = self._createGanttGroup(dataPoint, parentState);
                console.log("Create group", group.columnTitle, "with parent", parentState.value, "(", parentState.id, ")");
                // Remove parent if match the root ID to avoid task not found error from gantt library
                if (group.parent === rootState.id) {
                    group.parent = false;
                }
                rootState.ganttDataFull.items.push(group);
                self.createGanttGroupsAndItems(rootState, dataPoint);
            });

            // Create items next
            var dataItems = parentState.data.filter(function (dataPoint) {
                return dataPoint.type === "record";
            });
            dataItems.forEach(function (dataPoint) {
                var item = self._createGanttItem(dataPoint, parentState);
                console.log("Create item", item.columnTitle, "with parent", parentState.value, "(", parentState.id, ")");
                // Remove parent if match the root ID to avoid task not found error from gantt library
                if (item.parent === rootState.id) {
                    item.parent = false;
                }
                self._setGanttItemCssClass(item);
                rootState.ganttDataFull.items.push(item);
            });
        },

        _setGanttItemCssClass: function (ganttItem) {
            const CSS_CLASSES_LENGTH = 28;
            var self = this;
            // Set task color index from parent ID
            if (self.fieldsMapping.cssClass) {
                var uniqueId = ganttItem.parent;
                var rec = ganttItem.dataPoint.data;
                if (!(uniqueId in self.cssClasses)) {
                    var idx = 1 + Object.keys(self.cssClasses).length % CSS_CLASSES_LENGTH;
                    if (rec[self.fieldsMapping.cssClass]) {
                        self.cssClasses[uniqueId] = rec[self.fieldsMapping.cssClass] + " ";
                    } else {
                        self.cssClasses[uniqueId] = "";
                    }
                    self.cssClasses[uniqueId] += "o_dhx_gantt_color_" + idx;
                }
                ganttItem.cssClass = self.cssClasses[uniqueId];
            }
        },

        _createGanttGroup: function (dataPoint, parentDataPoint) {
            var self = this;
            // var field = groupBy[currentIdx];

            var group = {
                dataPoint: dataPoint, // Keep a refence on original dataPoint
                id: dataPoint.id,
                parent: parentDataPoint && parentDataPoint.id || false,
                type: gantt.config.types.project,
                isGroup: true,
                open: true,
                groupBy: {},
                // Use the field name as default value for the column title
                // columnTitle: field,
                columnTitle: _t("Undefined"),
            };

            if (dataPoint.value) {
                group.columnTitle = `${dataPoint.value} (${dataPoint.count})`;
            }

            return group;
        },

        _createGanttItem: function (dataPoint, parentDataPoint) {
            var self = this;
            var item = {
                dataPoint: dataPoint, // Keep a refence on original dataPoint
                id: dataPoint.id,
                parent: parentDataPoint && parentDataPoint.id || false,
                type: gantt.config.types.task,
            };

            // Field name mapping defined in the XML gantt view
            var mapping = self.fieldsMapping;
            // Record data
            var rec = dataPoint.data;

            // Set items without valid dates as unscheduled
            // they can be hidden using `show_unscheduled=False`
            if (rec[mapping.dateStart] == false
                || rec[mapping.dateStop] == false
                || rec[mapping.dateStart] == rec[mapping.dateStop]) {
                item.unscheduled = true;
            } else {
                item.start_date = self._convertMomentDateToGanttDate(rec, mapping.dateStart);
                item.end_date = self._convertMomentDateToGanttDate(rec, mapping.dateStop);
            }

            if (self.fieldsMapping.dateDeadline) {
                item.dateDeadline = self._convertMomentDateToGanttDate(rec, mapping.dateDeadline);
            }

            // TODO: Convert duration to a function in order have it fully
            // updated on view changes (if possible)
            if (mapping.duration) {
                if (gantt.config.duration_unit == "minute") {
                    item.duration = rec[mapping.duration];
                } else if (gantt.config.duration_unit == "hour") {
                    item.duration = rec[mapping.duration] / 60;
                } else if (gantt.config.duration_unit == "day") {
                    item.duration = rec[mapping.duration] / 60 / 7;
                }
            }

            if (mapping.textInside) {
                item.text = rec[mapping.textInside];
            }

            // Set main title visible in the left column
            if (Array.isArray(rec[mapping.columnTitle])) {
                item.columnTitle = rec[mapping.columnTitle][1];
            } else {
                item.columnTitle = rec[mapping.columnTitle];
            }

            // Set item left text (before progress bar)
            if (mapping.textLeftside) {
                item.textLeftSide = rec[mapping.textLeftside];
            }

            // Set item right text (after progress bar)
            if (mapping.textRightside) {
                item.textRightside = rec[mapping.textRightside];
            }

            if (mapping.progress) {
                item.progress = rec[mapping.progress] / 100.0;
            }
            if (mapping.open) {
                item.open = rec[mapping.open];
            }

            item.tooltipTextFn = function (start, end) {
                var res = []
                if (item.textLeftside) {
                    res.push(item.textLeftside);
                }
                if (item.textRightside) {
                    res.push(item.textRightside);
                }
                res.push("<b>" + _lt("Start date:") + "</b> " + start);
                res.push("<b>" + _lt("End date:") + "</b> " + end);
                if (item.text) {
                    res.push(item.text);
                }
                return res.join("<br/>");
            }

            return item;
        },

        _convertMomentDateToGanttDate(rec, date_name) {
            var formatFunc = gantt.date.str_to_date("%Y-%m-%d %H:%i:%s", true);
            var date;
            if (rec[date_name]) {
                date = formatFunc(rec[date_name].format("YYYY-MM-DD H:mm:ss"));
            } else {
                date = false;
            }
            return date;
        },

        disableAllButtons: function () {
            this.$('.o_dhx_gantt_header').find('button').prop('disabled', true);
        },
        enableAllButtons: function () {
            this.$('.o_dhx_gantt_header').find('button').prop('disabled', false);
        },
        undoRenderCriticalTasks: function (data) {
            gantt.eachTask(function (item) {
                item.color = "";
            });
            gantt.getLinks().forEach(function (item) {
                item.color = "";
            });
            gantt.render();
        },
        renderCriticalTasks: function (data) {
            data.tasks.forEach(function (item) {
                var task = gantt.getTask(item);
                if (task) {
                    task.color = "red";
                }
            });
            data.links.forEach(function (item) {
                var link = gantt.getLink(item);
                if (link) {
                    link.color = "red";
                }
            });
            if (data.tasks.length > 0) {
                gantt.render();
            }
        },
        destroy: function () {
            gantt.clearAll();
            this._super.apply(this, arguments);
        },
    });
    return GanttRenderer;
});

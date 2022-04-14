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

            self.modelName = params.modelName;
            self.fieldsViewInfo = params.fieldsViewInfo;

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
                { name: "text_rightside", label: "Assign.", align: "left", width: 120 },
                { name: "date_deadline", label: "Limit", align: "center", width: 80, resize: true },
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
                return task.css_class;
            };

            gantt.templates.grid_row_class = function (start, end, task) {
                return task.css_class;
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

            gantt.templates.tooltip_text = function (start, end, task) {
                console.log(self.state.fields);
                if (task.type == gantt.config.types.task) {
                    return task.tooltipTextFn(gantt.templates.tooltip_date_format(start), gantt.templates.tooltip_date_format(end));
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
        on_attach_callback: function () {
            this.renderGantt();
        },

        /**
         * Render the view
         *
         * @override
         * @returns {Deferred}
         */
        _render: function () {
            var self = this;
            var res = this._super.apply(this, arguments);
            res.then(function () {
                self.renderGantt();
            });
            return res;
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
                this.events_set = true;
            }
            gantt.clearAll();

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
            gantt.parse(this.state.ganttData);
            gantt.render();
        },
        updateState: function (state, params) {
            // this method is called by the controller when the search view is changed. we should 
            // clear the gantt chart, and add the new tasks resulting from the search
            var res = this._super.apply(this, arguments);
            gantt.clearAll();
            return res;
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

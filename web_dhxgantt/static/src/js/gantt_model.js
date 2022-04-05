odoo.define('web_dhxgantt.GanttModel', function (require) {
    "use strict";

    var AbstractModel = require('web.AbstractModel');
    var core = require('web.core');

    var _lt = core._lt;

    var GanttModel = AbstractModel.extend({
        get: function () {
            // Get is called by AbstractController.update() and the result
            // is stored in `state` variable
            var gantt_model = {
                data: this.records,
                links: this.links,
            }
            var res = {
                records: gantt_model,
            };
            return res;
        },
        load: function (params) {
            this.fields = params.fields;
            this.modelName = params.modelName;
            this.linkModelName = params.linkModelName;
            this.parentModelName = params.parentModelName;

            // Store field names mapping (params are read from arch in
            // gantt_view.js)
            this.task_map = {}
            this.task_map.identifier = params.identifier;
            this.task_map.task_text = params.task_text;
            this.task_map.date_start = params.date_start;
            this.task_map.date_stop = params.date_stop;
            this.task_map.date_deadline = params.date_deadline;
            this.task_map.duration = params.duration;
            this.task_map.progress = params.progress;
            this.task_map.open = params.open;
            this.task_map.links = params.links;
            this.task_map.parent = params.parent;
            this.task_map.column_title = params.column_title;
            this.task_map.css_class = params.css_class;
            this.task_map.assigned_text = params.assigned_text;

            this.parent_map = {}
            this.parent_map.date_start = params.parent_date_start;
            this.parent_map.date_stop = params.parent_date_stop;

            this.defaultGroupBy = params.defaultGroupBy ? [params.defaultGroupBy] : [];

            return this._load(params);
        },
        reload: function (id, params) {
            var self = this;
            if ('groupBy' in params === false) {
                params.groupBy = self.groupBy;
            }
            return self._load(params);
        },
        _getFields: function () {
            var self = this;
            var values = Object.keys(self.task_map).filter(function (key) {
                let field = self.task_map[key];
                // Do not include fields not defined in the xml view
                if (field === undefined) {
                    return false;
                };
                return true;
            }).map(function (key) {
                return self.task_map[key];
            });
            return values;
        },
        _getParentFields: function () {
            var self = this;
            var values = Object.keys(self.parent_map).filter(function (key) {
                let field = self.parent_map[key];
                // Do not include fields not defined in the xml view
                if (field === undefined) {
                    return false;
                };
                return true;
            }).map(function (key) {
                return self.parent_map[key];
            });
            return values;
        },
        _getDateFields: function () {
            var self = this;
            return [
                self.task_map.date_start,
                self.task_map.date_stop,
            ]
        },
        _load: function (params) {
            var self = this;
            params = params ? params : {};
            self.domain = params.domain || self.domain || [];
            self.modelName = params.modelName || self.modelName;
            self.groupBy = self.defaultGroupBy;
            if (params.groupBy && params.groupBy.length > 0) {
                self.groupBy = params.groupBy;
            }
            return self._rpc({
                model: self.modelName,
                method: 'read_group',
                fields: self._getFields(),
                domain: self.domain,
                groupBy: self.groupBy,
                orderBy: [{
                    name: self.task_map.identifier,
                    asc: true,
                }],
                lazy: false,
            }).then(function (groups) {
                return self._rpc({
                    model: self.modelName,
                    method: 'search_read',
                    fields: self._getFields().concat(self.groupBy),
                    domain: self.domain,
                }).then(function (records) {
                    self.convertData(records, groups, self.groupBy);
                });
            });
        },
        parseDate(rec, date_name) {
            var formatFunc = gantt.date.str_to_date("%Y-%m-%d %H:%i:%s", true);
            var date;
            if (rec[date_name]) {
                date = formatFunc(rec[date_name]);
            } else {
                date = false;
            }
            return date;
        },
        findGroup: function (groupList, groupBy) {
            if (groupList.length > 0 && Object.keys(groupBy).length > 0) {
                for (let i = 0; i < groupList.length; i++) {
                    var group = groupList[i];
                    if (_.isEqual(group.groupBy, groupBy)) {
                        return group;
                    }
                }
            }
            return false;
        },
        create_task: function (rec, ganttGroups, groupBy, links, css_classes) {
            const CSS_CLASSES_LENGTH = 28;
            var self = this;

            var task = {};
            task.id = rec[self.task_map.identifier];
            task.text = rec[self.task_map.task_text];
            task.type = gantt.config.types.task;

            // Set tasks without valid dates as unscheduled
            // they can be hide using `show_unscheduled=False`
            if (rec[self.task_map.date_start] == false
                || rec[self.task_map.date_stop] == false
                || rec[self.task_map.date_start] == rec[self.task_map.date_stop]) {
                task.unscheduled = true;
            } else {
                task.start_date = self.parseDate(rec, self.task_map.date_start);
                task.end_date = self.parseDate(rec, self.task_map.date_stop);
            }

            if (self.task_map.date_deadline) {
                task.date_deadline = self.parseDate(rec, self.task_map.date_deadline);
            }

            if (Array.isArray(rec[self.task_map.column_title])) {
                task.column_title = rec[self.task_map.column_title][1];
            } else {
                task.column_title = rec[self.task_map.column_title];
            }
            task.columnTitle = task.column_title || _lt("Unassigned");

            if (self.task_map.progress) {
                task.progress = rec[self.task_map.progress] / 100.0;
            }
            if (self.task_map.open) {
                task.open = rec[self.task_map.open];
            }

            if (gantt.config.duration_unit == "minute") {
                task.duration = rec[self.task_map.duration];
            } else if (gantt.config.duration_unit == "hour") {
                task.duration = rec[self.task_map.duration] / 60;
            } else if (gantt.config.duration_unit == "day") {
                task.duration = rec[self.task_map.duration] / 60 / 7;
            }

            // Retrieve and set parent from already created project/groups
            // 1 - Build groupBy for this record
            var recGroupBy = {};
            for (let j = 0; j < groupBy.length; j++) {
                var field = groupBy[j];
                var value = rec[field];
                recGroupBy[field] = value;
            }
            // 2 - Retrieve its parent with this groupBy
            var parent = self.findGroup(ganttGroups, recGroupBy);
            if (parent) {
                task.parent = parent.id;
            }

            if (self.task_map.links) {
                task.links = rec[self.task_map.links];
                links.push.apply(links, JSON.parse(task.links))
            }

            // Set task color index from parent ID
            if (self.task_map.css_class) {
                var unique_id = task.parent;
                if (!(unique_id in css_classes)) {
                    var idx = 1 + Object.keys(css_classes).length % CSS_CLASSES_LENGTH;
                    if (rec[self.task_map.css_class]) {
                        css_classes[unique_id] = rec[self.task_map.css_class] + " ";
                    } else {
                        css_classes[unique_id] = "";
                    }
                    css_classes[unique_id] += "o_dhx_gantt_color_" + idx;
                }
                task.css_class = css_classes[unique_id];
            }

            if (self.task_map.assigned_text) {
                task.assigned_text = rec[self.task_map.assigned_text];
            }

            return task;
        },
        convertData: function (records, groups, groupBy) {
            var self = this;

            var ganttGroups = [];
            var data = [];
            var parentIDs = [];
            // todo: convert date from utc to mgt or wtever

            // Create gantt-projects from groups
            for (let i = 0; i < groupBy.length; i++) {

                groups.forEach(function (resGroup) {
                    var field = groupBy[i];

                    var groupTemplate = {
                        id: _.uniqueId(field + "_js_"),
                        type: gantt.config.types.project,
                        isGroup: true,
                        open: true,
                        groupBy: {},
                        // Use the field name as default value for the column title
                        columnTitle: field,
                    }

                    var parentGroupBy = {};
                    for (let j = 0; j <= i; j++) {
                        var field = groupBy[j];
                        var value = resGroup[field];
                        groupTemplate.groupBy[field] = value;
                        if (j < i) {
                            parentGroupBy[field] = value;
                        }
                    }

                    var byValue = resGroup[field];
                    if (Array.isArray(byValue)) {
                        groupTemplate.text = byValue[1];
                        groupTemplate.columnTitle = groupTemplate.text;
                    } else {
                        groupTemplate.text = byValue;
                        groupTemplate.columnTitle = byValue;
                    }

                    var group = self.findGroup(ganttGroups, groupTemplate.groupBy);
                    if (!group) {
                        // Create a new group
                        group = Object.assign({}, groupTemplate);
                        console.log("Create group", group.id, group.text, "for field", field, "with groupBy", group.groupBy);
                        // Find its parent
                        var parent = self.findGroup(ganttGroups, parentGroupBy);
                        if (parent) {
                            group.parent = parent.id;
                        }
                        // Add model informations to allow opening it as a Form
                        if (Array.isArray(byValue) && field in self.fields) {
                            group.modelName = self.fields[field].relation || '';
                            group.modelId = byValue[0] || 0;
                            // Populate parent arrays used to fullfill group
                            // data (start_date, end_date, etc.)
                            if (group.modelName == self.parentModelName) {
                                parentIDs.push(group.modelId);
                            }
                        }
                        ganttGroups.push(group);
                        data.push(group);

                    } else {
                        console.log("Reuse group", group.id, group.text, "for field", field, "with groupBy", group.groupBy);
                    }

                });
            }

            // Query group data (only if parent model is set in the xml view)
            if (self.parentModelName !== undefined) {
                self._rpc({
                    model: self.parentModelName,
                    method: 'read',
                    args: [
                        parentIDs,
                        self._getParentFields(),
                    ],
                    context: this.context,
                }).then(function (parentRecords) {
                    parentRecords.forEach(function (rec) {
                        var group = ganttGroups.find(function (element) {
                            if (element.modelId == rec.id && element.modelName == self.parentModelName) {
                                return element;
                            }
                        });
                        if (group) {
                            var date = self.parseDate(rec, self.parent_map.date_start);
                            if (date) {
                                group.start_date = date;
                            }
                            var date = self.parseDate(rec, self.parent_map.date_stop);
                            if (date) {
                                group.end_date = date;
                            }
                        }
                    });
                });
            }

            self.res_ids = [];
            var links = [];
            var css_classes = {}

            // Create gantt-tasks from records
            records.forEach(function (rec) {
                self.res_ids.push(rec[self.task_map.identifier]);
                var task = self.create_task(rec, ganttGroups, groupBy, links, css_classes);

                data.push(task);
            });

            self.records = data;
            // self.links = links;
        },
        writeTask: function (data) {
            var self = this;
            if (data.isGroup) {
                return $.when();
            }
            var values = {};
            if ('text' in data) {
                values[self.task_map.text] = data.text;
            }
            if ('open' in data) {
                values[self.task_map.open] = data.open;
            }
            if ('progress' in data) {
                values[self.task_map.progress] = data.progress;
            }

            if ('duration' in data) {
                if (gantt.config.duration_unit == "minute") {
                    values[self.task_map.duration] = data.duration;
                } else if (gantt.config.duration_unit == "hour") {
                    values[self.task_map.duration] = data.duration * 60;
                } else if (gantt.config.duration_unit == "day") {
                    values[self.task_map.duration] = data.duration * 60 * 7;
                }
            }

            var backward = false;
            var formatFunc = gantt.date.str_to_date("%d-%m-%Y %H:%i");
            if ('start_date' in data) {
                var date_start = formatFunc(data.start_date);
                values[self.task_map.date_start] = JSON.stringify(date_start);
            }
            if ('end_date' in data) {
                var date_stop = formatFunc(data.end_date);
                values[self.task_map.date_stop] = JSON.stringify(date_stop);
            }

            if ('previous_start_date' in data) {
                var previous_date_start = formatFunc(data.previous_start_date);
                backward = date_start < previous_date_start;
            }
            if ('previous_end_date' in data) {
                var previous_date_stop = formatFunc(data.previous_end_date);
            }

            return self._rpc({
                model: self.modelName,
                method: 'write',
                args: [data.id, values],
                context: self.getContext(),
            }).then(function (res) {
                if (res) {
                    return self._rpc({
                        model: self.modelName,
                        method: 'update_gantt_schedule',
                        args: [[data.id], backward],
                        context: self.getContext(),
                    });
                };
            });
        },
        reloadTaskDates: function (ids) {
            var self = this;
            return self._rpc({
                model: self.modelName,
                method: 'search_read',
                fields: self._getDateFields(),
                domain: [['id', 'in', ids]],
            }).then(function (records) {
                records.forEach(function (rec) {
                    var task = gantt.getTask(rec.id);
                    if (task) {
                        task.start_date = self.parseDate(rec, self.task_map.date_start);
                        task.end_date = self.parseDate(rec, self.task_map.date_stop);
                    }
                });
            });
        },
        createLink: function (data) {
            var self = this;
            var values = {};
            values.id = data.id;
            values.source_id = data.source;
            values.target_id = data.target;
            values.type = data.type;

            return self._rpc({
                model: self.linkModelName,
                method: 'create',
                args: [values],
                context: self.getContext(),
            }).then(function (res) {
                if (res) {
                    // Add (don't replace) database ID
                    var updatedData = {
                        'databaseId': res
                    };
                    gantt.updateLink(data.id, updatedData);
                    return self._rpc({
                        model: self.modelName,
                        method: 'update_gantt_schedule',
                        args: [parseInt(values.source_id)],
                        context: self.getContext(),
                    });
                };
            });
        },
        deleteLink: function (data) {
            var self = this;
            return self._rpc({
                model: self.linkModelName,
                method: 'unlink',
                args: [data.databaseId],
                context: self.getContext(),
            });
        },
        getCriticalPath: function () {
            var self = this;
            return self._rpc({
                model: self.modelName,
                method: 'compute_critical_path',
                args: [self.res_ids],
            });
        },
        schedule: function () {
            var self = this;
            return self._rpc({
                model: self.modelName,
                method: 'bf_traversal_schedule',
                args: [self.res_ids],
            });
        },
        getContext: function () {
            return { 'gantt_duration_unit': gantt.config.duration_unit }
        },
    });
    return GanttModel;
});
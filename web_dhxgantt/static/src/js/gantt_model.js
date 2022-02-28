odoo.define('web_dhxgantt.GanttModel', function (require) {
    "use strict";

    var AbstractModel = require('web.AbstractModel');

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

            // Store field names mapping (params are read from arch in
            // gantt_view.js)
            this.task_map = {}
            this.task_map.identifier = params.identifier;
            this.task_map.text = params.text;
            this.task_map.date_start = params.date_start;
            this.task_map.date_stop = params.date_stop;
            this.task_map.duration = params.duration;
            this.task_map.progress = params.progress;
            this.task_map.open = params.open;
            this.task_map.links = params.links;
            this.task_map.parent = params.parent;
            this.task_map.owner = params.owner;
            this.task_map.css_class = params.css_class;

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
            var values = Object.keys(self.task_map).map(function (key) {
                return self.task_map[key];
            });
            return values;
        },
        _getParentFields: function () {
            var self = this;
            var values = Object.keys(self.parent_map).map(function (key) {
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
            var formatFunc = gantt.date.str_to_date("%Y-%m-%d %h:%i:%s", true);
            var date;
            if (rec[date_name]) {
                date = formatFunc(rec[date_name]);
            } else {
                date = false;
            }
            return date;
        },
        convertData: function (records, groups, groupBy) {
            var data = [];
            var parents = [];
            var parent_ids = [];
            var parent_model_name = false;
            // todo: convert date from utc to mgt or wtever
            var self = this;

            // Create projects from groups
            groups.forEach(function (rec) {
                let parentProject = null;
                groupBy.forEach(function (field) {
                    var project = {
                        id: _.uniqueId('project-'),
                        groupBy: {},
                        type: gantt.config.types.project,
                        isGroup: true,
                        open: true,
                        columnTitle: field,
                    }
                    // Add current field value (raw or id) to groupBy domain
                    if (Array.isArray(rec[field])) {
                        project.groupBy[field] = rec[field][0];
                        project.text = rec[field][1];
                        project.columnTitle = rec[field][1] + ' ' + project.columnTitle;
                        // Add model informations to allow opening it as a Form
                        if (field in self.fields) {
                            project.modelName = self.fields[field].relation || '';
                            project.modelId = rec[field][0] || 0;
                            if (parent_model_name == false) {
                                parent_model_name = project.modelName;
                            }
                            if (project.modelName == parent_model_name) {
                                parent_ids.push(project.modelId);
                            }
                        }
                    } else {
                        project.groupBy[field] = rec[field];
                        project.text = rec[field];
                    }
                    if (parentProject) {
                        project.groupBy = Object.assign({}, project.groupBy, parentProject.groupBy);
                        project.parent = parentProject.id;
                    }
                    parentProject = project;
                    // Do not add project to data, we just put it
                    // in a temporary list
                    parents.push(project);
                });
            });

            self._rpc({
                model: parent_model_name,
                method: 'read',
                args: [
                    parent_ids,
                    self._getParentFields(),
                ],
                context: this.context,
            }).then(function (parent_records) {
                //self.convertData(records, groups, self.groupBy);
                parent_records.forEach(function (rec) {
                    console.log(rec);
                    var parent = parents.find(function (element) {
                        if (element.modelId == rec.id) {
                            return element;
                        }
                    });
                    if (parent) {
                        var date = self.parseDate(rec, self.parent_map.date_start);
                        if (date) {
                            parent.start_date = date;
                        }
                        var date = self.parseDate(rec, self.parent_map.date_stop);
                        if (date) {
                            parent.end_date = date;
                        }
                    }
                });
            });

            self.res_ids = [];
            var parents_added_to_data = [];
            var links = [];
            var css_classes = {}
            const css_classes_length = 20;

            // Create tasks from records
            records.forEach(function (rec) {
                if (rec[self.task_map.date_start] == false || rec[self.task_map.date_stop] == false
                    || rec[self.task_map.date_start] == rec[self.task_map.date_stop]) {
                    // Do not add tasks without valid dates
                } else {
                    self.res_ids.push(rec[self.task_map.identifier]);

                    var task = {};
                    task.id = rec[self.task_map.identifier];
                    task.text = rec[self.task_map.text];
                    task.type = gantt.config.types.type_task;
                    task.start_date = self.parseDate(rec, self.task_map.date_start);
                    task.end_date = self.parseDate(rec, self.task_map.date_stop);
                    task.owner = rec[self.task_map.owner][1];
                    task.progress = rec[self.task_map.progress] / 100.0;
                    task.open = rec[self.task_map.open];
                    task.links = rec[self.task_map.links];
                    task.columnTitle = task.owner;

                    var owner_id = rec[self.task_map.owner][0];
                    if (!(owner_id in css_classes)) {
                        var idx = 1 + Object.keys(css_classes).length % css_classes_length;
                        if (rec[self.task_map.css_class]) {
                            css_classes[owner_id] = rec[self.task_map.css_class] + " ";
                        } else {
                            css_classes[owner_id] = "";
                        }
                        css_classes[owner_id] += "o_dhx_gantt_color_" + idx;
                    }
                    task.css_class = css_classes[owner_id];

                    if (gantt.config.duration_unit == "minute") {
                        task.duration = rec[self.task_map.duration];
                    } else if (gantt.config.duration_unit == "hour") {
                        task.duration = rec[self.task_map.duration] / 60;
                    } else if (gantt.config.duration_unit == "day") {
                        task.duration = rec[self.task_map.duration] / 60 / 7;
                    }

                    // Retrieve and set parent from already created project/groups
                    var parent = parents.find(function (element) {
                        if ("groupBy" in element) {
                            var matchNeeded = 0;
                            var matchCount = 0;
                            for (const [idx, field] of Object.entries(groupBy)) {
                                if (field in rec) {
                                    matchNeeded++;
                                    var value = rec[field];
                                    if (Array.isArray(rec[field])) {
                                        value = rec[field][0];
                                    }
                                    if (value == element.groupBy[field]) {
                                        matchCount++;
                                    }
                                }
                            }
                            if (matchNeeded > 0 && matchNeeded == matchCount) {
                                return element;
                            }
                        }
                    });
                    if (parent) {
                        task.parent = parent.id;
                        // Add task parent to data list if not already 
                        // pushed
                        if (!parents_added_to_data.includes(parent.id)) {
                            parents_added_to_data.push(parent.id);
                            data.push(parent);
                        }
                    }

                    data.push(task);
                    links.push.apply(links, JSON.parse(task.links))
                }
            });
            self.records = data;
            self.links = links;
        },
        writeTask: function (data) {
            var self = this;
            if (data.isGroup) {
                return $.when();
            }
            var values = {};
            values[self.task_map.text] = data.text;
            values[self.task_map.open] = data.open;
            values[self.task_map.progress] = data.progress;

            if (gantt.config.duration_unit == "minute") {
                values[self.task_map.duration] = data.duration;
            } else if (gantt.config.duration_unit == "hour") {
                values[self.task_map.duration] = data.duration * 60;
            } else if (gantt.config.duration_unit == "day") {
                values[self.task_map.duration] = data.duration * 60 * 7;
            }

            var formatFunc = gantt.date.str_to_date("%d-%m-%Y %h:%i");
            var date_start = formatFunc(data.start_date);
            var date_stop = formatFunc(data.end_date);
            values[self.task_map.date_start] = JSON.stringify(date_start);
            values[self.task_map.date_stop] = JSON.stringify(date_stop);

            var previous_date_start = formatFunc(data.previous_start_date);
            var previous_date_stop = formatFunc(data.previous_end_date);

            var backward = date_start < previous_date_start;

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
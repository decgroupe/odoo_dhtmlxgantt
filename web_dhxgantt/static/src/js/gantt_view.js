odoo.define('web_dhxgantt.GanttView', function (require) {
    "use strict";

    // odoo/addons/web/static/src/js/views/basic/basic_view.js
    var BasicView = require('web.BasicView');
    var GanttController = require('web_dhxgantt.GanttController');
    var GanttModel = require('web_dhxgantt.GanttModel');
    var GanttRenderer = require('web_dhxgantt.GanttRenderer');
    var viewRegistry = require('web.view_registry');
    var core = require('web.core');

    var _lt = core._lt;

    var GanttView = BasicView.extend({
        viewType: 'dhxgantt',
        groupable: true,
        display_name: _lt('Gantt'),
        icon: 'fa-tasks',
        config: _.extend({}, BasicView.prototype.config, {
            Controller: GanttController,
            Model: GanttModel,
            Renderer: GanttRenderer,
        }),
        init: function (viewInfo, params) {
            this._super.apply(this, arguments);

            this.loadParams.type = 'list';
            // `fields` and `modelName` are already set in BasicView
            this.loadParams.parentModelName = this.arch.attrs.parent_model_name;
            this.loadParams.linkModelName = this.arch.attrs.link_model_name;
            this.loadParams.defaultGroupBy = this.arch.attrs.default_group_by;

            // Save model fields to read and map them with internal names
            var fieldsMapping = {
                identifier: this.arch.attrs.identifier,
                textLeftside: this.arch.attrs.task_text_leftside,
                textInside: this.arch.attrs.task_text,
                textRightside: this.arch.attrs.task_text_rightside,
                dateStart: this.arch.attrs.date_start,
                dateStop: this.arch.attrs.date_stop,
                dateDeadline: this.arch.attrs.date_deadline,
                duration: this.arch.attrs.duration,
                progress: this.arch.attrs.progress,
                open: this.arch.attrs.open,
                links: this.arch.attrs.links,
                parent: this.arch.attrs.parent,
                columnTitle: this.arch.attrs.column_title,
                cssClass: this.arch.attrs.css_class,
            };
            // TODO: add these fields to the list of automatically fetched data
            // without having to declare a <field> LOOK AT getFieldNames
            this.loadParams.fieldsMapping = fieldsMapping;
            
            // Save parent model fields to read and map them with internal names
            var parentFieldsMapping = {
                dateStart: this.arch.attrs.parent_date_start,
                dateStop: this.arch.attrs.parent_date_stop,
            };
            this.loadParams.parentFieldsMapping = parentFieldsMapping;

            this.rendererParams.modelName = params.modelName;
            this.rendererParams.fieldsViewInfo = viewInfo.fields;
            this.rendererParams.fieldsMapping = fieldsMapping;
            this.rendererParams.parentFieldsMapping = parentFieldsMapping;
            this.rendererParams.drag_progress = (this.arch.attrs.drag_progress == "true");
        },
        _processFieldsView: function (fieldsView, viewType) {
            var fv = this._super.apply(this, arguments);
            return fv;
        },
    })

    viewRegistry.add('dhxgantt', GanttView);
    return GanttView;
});

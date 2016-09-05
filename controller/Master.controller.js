// /*global history */
// sap.ui.define([
// 	"com/corona/controller/BaseController",
// 	"sap/ui/model/json/JSONModel",
// 	"sap/ui/model/Filter",
// 	"sap/ui/model/FilterOperator",
// 	"sap/m/GroupHeaderListItem",
// 	"sap/ui/Device",
// 	"com/corona/model/formatter",
// 	"sap/m/MessageBox"
// ], function(BaseController, JSONModel, Filter, FilterOperator, GroupHeaderListItem, Device, formatter, MessageBox) {
// 	"use strict";

// 	return BaseController.extend("com.corona.controller.Master", {

// 		formatter: formatter,

// 		/* =========================================================== */
// 		/* lifecycle methods                                           */
// 		/* =========================================================== */

// 		/**
// 		 * Called when the master list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
// 		 * @public
// 		 */
// 		onInit: function() {
// 			// Control state model
// 			var oList = this.byId("list"),
// 				oViewModel = this._createViewModel(),
// 				// Put down master list's original value for busy indicator delay,
// 				// so it can be restored later on. Busy handling on the master list is
// 				// taken care of by the master list itself.
// 				iOriginalBusyDelay = oList.getBusyIndicatorDelay();
// 			this._oListSelector = this.getOwnerComponent().oListSelector;

// 			this._oList = oList;
// 			// keeps the filter and search state
// 			this._oListFilterState = {
// 				aFilter: [],
// 				aSearch: []
// 			};

// 			this.setModel(oViewModel, "masterView");
// 			// Make sure, busy indication is showing immediately so there is no
// 			// break after the busy indication for loading the view's meta data is
// 			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
// 			oList.attachEventOnce("updateFinished", function() {
// 				// Restore original busy indicator delay for the list
// 				oViewModel.setProperty("/delay", iOriginalBusyDelay);
// 			});

// 			this.getView().addEventDelegate({
// 				onBeforeFirstShow: function() {
// 					this._oListSelector.setBoundMasterList(oList);
// 				}.bind(this)
// 			});

// 			this.getRouter().getRoute("master").attachPatternMatched(this._onMasterMatched, this);
// 			this.getRouter().attachBypassed(this.onBypassed, this);
// 			this._oODataModel = this.getOwnerComponent().getModel();
// 		},

// 		/* =========================================================== */
// 		/* event handlers                                              */
// 		/* =========================================================== */

// 		/**
// 		 * After list data is available, this handler method updates the
// 		 * master list counter and hides the pull to refresh control, if
// 		 * necessary.
// 		 * @param {sap.ui.base.Event} oEvent the update finished event
// 		 * @public
// 		 */
// 		onUpdateFinished: function(oEvent) {
// 			// update the master list object counter after new data is loaded
// 			this._updateListItemCount(oEvent.getParameter("total"));
// 			// hide pull to refresh if necessary
// 			this.byId("pullToRefresh").hide();
// 			this._findItem();
// 			this.getModel("appView").setProperty("/addEnabled", true);
// 		},

// 		/**
// 		 * Event handler for the master search field. Applies current
// 		 * filter value and triggers a new search. If the search field's
// 		 * 'refresh' button has been pressed, no new search is triggered
// 		 * and the list binding is refresh instead.
// 		 * @param {sap.ui.base.Event} oEvent the search event
// 		 * @public
// 		 */
// 		onSearch: function(oEvent) {
// 			if (oEvent.getParameters().refreshButtonPressed) {
// 				// Search field's 'refresh' button has been pressed.
// 				// This is visible if you select any master list item.
// 				// In this case no new search is triggered, we only
// 				// refresh the list binding.
// 				this.onRefresh();
// 				return;
// 			}

// 			var sQuery = oEvent.getParameter("query");

// 			if (sQuery) {
// 				this._oListFilterState.aSearch = [new Filter("Aufnr", FilterOperator.Contains, sQuery)];
// 			} else {
// 				this._oListFilterState.aSearch = [];
// 			}
// 			this._applyFilterSearch();

// 		},

// 		/**
// 		 * Event handler for refresh event. Keeps filter, sort
// 		 * and group settings and refreshes the list binding.
// 		 * @public
// 		 */
// 		onRefresh: function() {
// 			this._oList.getBinding("items").refresh();
// 		},

// 		/**
// 		 * Event handler for the sorter selection.
// 		 * @param {sap.ui.base.Event} oEvent the select event
// 		 * @public
// 		 */
// 		onSort: function(oEvent) {
// 			var sKey = oEvent.getSource().getSelectedItem().getKey(),
// 				aSorters = this._oGroupSortState.sort(sKey);

// 			this._applyGroupSort(aSorters);
// 		},

// 		/**
// 		 * Event handler for the list selection event
// 		 * @param {sap.ui.base.Event} oEvent the list selectionChange event
// 		 * @public
// 		 */
// 		onSelectionChange: function(oEvent) {
// 			var that = this;
// 			var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
// 			var fnLeave = function() {
// 				that._oODataModel.resetChanges();
// 				that._showDetail(oItem);
// 			};
// 			if (this._oODataModel.hasPendingChanges()) {
// 				this._leaveEditPage(fnLeave);
// 			} else {
// 				this._showDetail(oItem);
// 			}
// 			that.getModel("appView").setProperty("/addEnabled", true);
// 		},

// 		/**
// 		 * Event handler for the bypassed event, which is fired when no routing pattern matched.
// 		 * If there was an object selected in the master list, that selection is removed.
// 		 * @public
// 		 */
// 		onBypassed: function() {
// 			this._oList.removeSelections(true);
// 		},

// 		/**
// 		 * Used to create GroupHeaders with non-capitalized caption.
// 		 * These headers are inserted into the master list to
// 		 * group the master list's items.
// 		 * @param {Object} oGroup group whose text is to be displayed
// 		 * @public
// 		 * @returns {sap.m.GroupHeaderListItem} group header with non-capitalized caption.
// 		 */
// 		createGroupHeader: function(oGroup) {
// 			return new GroupHeaderListItem({
// 				title: oGroup.text,
// 				upperCase: false
// 			});
// 		},

// 		/**
// 		 * Navigates back in the browser history, if the entry was created by this app.
// 		 * If not, it navigates to the Fiori Launchpad home page
// 		 * @override
// 		 * @public
// 		 */
// 		onNavBack: function() {
// 			var oHistory = sap.ui.core.routing.History.getInstance(),
// 				sPreviousHash = oHistory.getPreviousHash(),
// 				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

// 			if (sPreviousHash !== undefined) {
// 				// The history contains a previous entry
// 				history.go(-1);
// 			} else {
// 				// Navigate back to FLP home
// 				oCrossAppNavigator.toExternal({
// 					target: {
// 						shellHash: "#Shell-home"
// 					}
// 				});
// 			}
// 		},

// 		/**
// 		 * Event handler  (attached declaratively) called when the add button in the master view is pressed. it opens the create view.
// 		 * @public
// 		 */
// 		onAdd: function() {
// 			this.getModel("appView").setProperty("/addEnabled", false);
// 			this.getRouter().getTargets().display("create");

// 		},

// 		/* =========================================================== */
// 		/* begin: internal methods                                     */
// 		/* =========================================================== */

// 		/**
// 		 * Creates the model for the view
// 		 * @private
// 		 */
// 		_createViewModel: function() {
// 			return new JSONModel({
// 				isFilterBarVisible: false,
// 				filterBarLabel: "",
// 				delay: 0,
// 				title: this.getResourceBundle().getText("masterTitleCount", [0]),
// 				noDataText: this.getResourceBundle().getText("masterListNoDataText"),
// 				sortBy: "Aufnr",
// 				groupBy: "None"
// 			});
// 		},

// 		/**
// 		 * Ask for user confirmation to leave the edit page and discard all changes
// 		 * @param {object} fnLeave - handles discard changes
// 		 * @param {object} fnLeaveCancelled - handles cancel
// 		 * @private
// 		 */
// 		_leaveEditPage: function(fnLeave, fnLeaveCancelled) {
// 			var sQuestion = this.getResourceBundle().getText("warningConfirm");
// 			var sTitle = this.getResourceBundle().getText("warning");

// 			MessageBox.show(sQuestion, {
// 				icon: MessageBox.Icon.WARNING,
// 				title: sTitle,
// 				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
// 				onClose: function(oAction) {
// 					if (oAction === MessageBox.Action.OK) {
// 						fnLeave();
// 					} else if (fnLeaveCancelled) {
// 						fnLeaveCancelled();
// 					}
// 				}
// 			});
// 		},

// 		/**
// 		 * If the master route was hit (empty hash) we have to set
// 		 * the hash to to the first item in the list as soon as the
// 		 * listLoading is done and the first item in the list is known
// 		 * @private
// 		 */
// 		_onMasterMatched: function() {
// 			this._oListSelector.oWhenListLoadingIsDone.then(
// 				function(mParams) {
// 					if (mParams.list.getMode() === "None") {
// 						return;
// 					}
// 					this.getModel("appView").setProperty("/addEnabled", true);
// 					if (!mParams.list.getSelectedItem()) {
// 						this.getRouter().navTo("object", {
// 							Aufnr: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Aufnr")),
// 							Auart: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Auart")),
// 							Werks: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Werks")),
// 							Qmart: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Qmart")),
// 							Qmnum: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Qmnum")),
// 							Rbnr: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Rbnr")),
// 							Aufpl: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Aufpl"))
// 						}, true);
// 					}
// 				}.bind(this),
// 				function(mParams) {
// 					if (mParams.error) {
// 						return;
// 					}
// 					this.getRouter().getTargets().display("detailNoObjectsAvailable");
// 				}.bind(this)
// 			);
// 		},

// 		/**
// 		 * Shows the selected item on the detail page
// 		 * On phones a additional history entry is created
// 		 * @param {sap.m.ObjectListItem} oItem selected Item
// 		 * @private
// 		 */
// 		_showDetail: function(oItem) {
// 			var bReplace = !Device.system.phone;
// 			this.getRouter().navTo("object", {
// 				Aufnr: encodeURIComponent(oItem.getBindingContext().getProperty("Aufnr")),
// 				Auart: encodeURIComponent(oItem.getBindingContext().getProperty("Auart")),
// 				Werks: encodeURIComponent(oItem.getBindingContext().getProperty("Werks")),
// 				Qmart: encodeURIComponent(oItem.getBindingContext().getProperty("Qmart")),
// 				Qmnum: encodeURIComponent(oItem.getBindingContext().getProperty("Qmnum")),
// 				Rbnr: encodeURIComponent(oItem.getBindingContext().getProperty("Rbnr")),
// 				Aufpl: encodeURIComponent(oItem.getBindingContext().getProperty("Aufpl"))
// 			}, bReplace);
// 		},

// 		/**
// 		 * Sets the item count on the master list header
// 		 * @param {integer} iTotalItems the total number of items in the list
// 		 * @private
// 		 */
// 		_updateListItemCount: function(iTotalItems) {
// 			var sTitle;
// 			// only update the counter if the length is final
// 			if (this._oList.getBinding("items").isLengthFinal()) {
// 				sTitle = this.getResourceBundle().getText("masterTitleCount", [iTotalItems]);
// 				this.getModel("masterView").setProperty("/title", sTitle);
// 			}
// 		},

// 		/**
// 		 * Internal helper method to apply both filter and search state together on the list binding
// 		 * @private
// 		 */
// 		_applyFilterSearch: function() {
// 			var aFilters = this._oListFilterState.aSearch.concat(this._oListFilterState.aFilter),
// 				oViewModel = this.getModel("masterView");
// 			this._oList.getBinding("items").filter(aFilters, "Application");
// 			// changes the noDataText of the list in case there are no filter results
// 			if (aFilters.length !== 0) {
// 				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataWithFilterOrSearchText"));
// 			} else if (this._oListFilterState.aSearch.length > 0) {
// 				// only reset the no data text to default when no new search was triggered
// 				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataText"));
// 			}
// 		},

// 		/**
// 		 * Internal helper method to apply both group and sort state together on the list binding
// 		 * @private
// 		 */
// 		_applyGroupSort: function(aSorters) {
// 			this._oList.getBinding("items").sort(aSorters);
// 		},

// 		/**
// 		 * Internal helper method that sets the filter bar visibility property and the label's caption to be shown
// 		 * @param {string} sFilterBarText the selected filter value
// 		 * @private
// 		 */
// 		_updateFilterBar: function(sFilterBarText) {
// 			var oViewModel = this.getModel("masterView");
// 			oViewModel.setProperty("/isFilterBarVisible", (this._oListFilterState.aFilter.length > 0));
// 			oViewModel.setProperty("/filterBarLabel", this.getResourceBundle().getText("masterFilterBarText", [sFilterBarText]));
// 		},

// 		/**
// 		 * Internal helper method that adds "/" to the item's path 
// 		 * @private
// 		 */
// 		_fnGetPathWithSlash: function(sPath) {
// 			return (sPath.indexOf("/") === 0 ? "" : "/") + sPath;
// 		},

// 		/**
// 		 * It navigates to the saved itemToSelect item. After delete it navigate to the next item. 
// 		 * After add it navigates to the new added item if it is displayed in the tree. If not it navigates to the first item.
// 		 * @private
// 		 */
// 		_findItem: function() {
// 			var itemToSelect = this.getModel("appView").getProperty("/itemToSelect");
// 			if (itemToSelect) {
// 				var sPath = this._fnGetPathWithSlash(itemToSelect);
// 				var oItem = this._oListSelector.findListItem(sPath);
// 				if (!oItem) { //item is not viewable in the tree. not in the current tree page.
// 					oItem = this._oListSelector.findFirstItem();
// 					if (oItem) {
// 						sPath = oItem.getBindingContext().getPath();
// 					} else {
// 						this.getRouter().getTargets().display("detailNoObjectsAvailable");
// 						return;
// 					}
// 				}
// 				this._oListSelector.selectAListItem(sPath);
// 				this._showDetail(oItem);
// 			}
// 		}

// 	});
// });




/*global history */
sap.ui.define([
	"com/corona/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/GroupHeaderListItem",
	"sap/ui/Device",
	"com/corona/model/formatter",
	"sap/m/MessageBox"
], function(BaseController, JSONModel, Filter, FilterOperator, GroupHeaderListItem, Device, formatter, MessageBox) {
	"use strict";

	return BaseController.extend("com.corona.controller.Master", {
		oPersonalizationDialog: null,
		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the master list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
		 * @public
		 */
		onInit: function() {
			// Control state model
			var oList = this.byId("list"),
				oViewModel = this._createViewModel(),
				// Put down master list's original value for busy indicator delay,
				// so it can be restored later on. Busy handling on the master list is
				// taken care of by the master list itself.
				iOriginalBusyDelay = oList.getBusyIndicatorDelay();
			this._oListSelector = this.getOwnerComponent().oListSelector;

			this._oList = oList;
			// keeps the filter and search state
			this._oListFilterState = {
				aFilter: [],
				aSearch: []
			};

			this.setModel(oViewModel, "masterView");
			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oList.attachEventOnce("updateFinished", function() {
				// Restore original busy indicator delay for the list
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});

			this.getView().addEventDelegate({
				onBeforeFirstShow: function() {
					this._oListSelector.setBoundMasterList(oList);
				}.bind(this)
			});

			this.getRouter().getRoute("master").attachPatternMatched(this._onMasterMatched, this);
			this.getRouter().attachBypassed(this.onBypassed, this);
			this._oODataModel = this.getOwnerComponent().getModel();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * After list data is available, this handler method updates the
		 * master list counter and hides the pull to refresh control, if
		 * necessary.
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function(oEvent) {
			// update the master list object counter after new data is loaded
			this._updateListItemCount(oEvent.getParameter("total"));
			// hide pull to refresh if necessary
			this.byId("pullToRefresh").hide();
			this._findItem();
			this.getModel("appView").setProperty("/addEnabled", true);

			if (!this.abrir_dialogo) {
				this.abrir_dialogo = true;
				//Agregar Dialogo
				this.f_open_dialog_login();

			}
		},

		/**
		 * Event handler for the master search field. Applies current
		 * filter value and triggers a new search. If the search field's
		 * 'refresh' button has been pressed, no new search is triggered
		 * and the list binding is refresh instead.
		 * @param {sap.ui.base.Event} oEvent the search event
		 * @public
		 */
		onSearch: function(oEvent) {
			if (oEvent.getParameters().refreshButtonPressed) {
				// Search field's 'refresh' button has been pressed.
				// This is visible if you select any master list item.
				// In this case no new search is triggered, we only
				// refresh the list binding.
				this.onRefresh();
				return;
			}

			var sQuery = oEvent.getParameter("query");

			if (sQuery) {
				this._oListFilterState.aSearch = [new Filter("Aufnr", FilterOperator.Contains, sQuery)];
			} else {
				this._oListFilterState.aSearch = [];
			}
			this._applyFilterSearch();

		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function() {
			this._oList.getBinding("items").refresh();
		},

		/**
		 * Event handler for the sorter selection.
		 * @param {sap.ui.base.Event} oEvent the select event
		 * @public
		 */
		onSort: function(oEvent) {
			var sKey = oEvent.getSource().getSelectedItem().getKey(),
				aSorters = this._oGroupSortState.sort(sKey);

			this._applyGroupSort(aSorters);
		},

		/**
		 * Event handler for the list selection event
		 * @param {sap.ui.base.Event} oEvent the list selectionChange event
		 * @public
		 */
		onSelectionChange: function(oEvent) {
			var that = this;
			var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
			var fnLeave = function() {
				that._oODataModel.resetChanges();
				that._showDetail(oItem);
			};
			if (this._oODataModel.hasPendingChanges()) {
				this._leaveEditPage(fnLeave);
			} else {
				this._showDetail(oItem);
			}
			that.getModel("appView").setProperty("/addEnabled", true);
		},

		/**
		 * Event handler for the bypassed event, which is fired when no routing pattern matched.
		 * If there was an object selected in the master list, that selection is removed.
		 * @public
		 */
		onBypassed: function() {
			this._oList.removeSelections(true);
		},

		/**
		 * Used to create GroupHeaders with non-capitalized caption.
		 * These headers are inserted into the master list to
		 * group the master list's items.
		 * @param {Object} oGroup group whose text is to be displayed
		 * @public
		 * @returns {sap.m.GroupHeaderListItem} group header with non-capitalized caption.
		 */
		createGroupHeader: function(oGroup) {
			return new GroupHeaderListItem({
				title: oGroup.text,
				upperCase: false
			});
		},

		/**
		 * Navigates back in the browser history, if the entry was created by this app.
		 * If not, it navigates to the Fiori Launchpad home page
		 * @override
		 * @public
		 */
		onNavBack: function() {
			var oHistory = sap.ui.core.routing.History.getInstance(),
				sPreviousHash = oHistory.getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			if (sPreviousHash !== undefined) {
				// The history contains a previous entry
				history.go(-1);
			} else {
				// Navigate back to FLP home
				oCrossAppNavigator.toExternal({
					target: {
						shellHash: "#Shell-home"
					}
				});
			}
		},

		/**
		 * Event handler  (attached declaratively) called when the add button in the master view is pressed. it opens the create view.
		 * @public
		 */
		onAdd: function() {
			this.getModel("appView").setProperty("/addEnabled", false);
			this.getRouter().getTargets().display("create");

		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Creates the model for the view
		 * @private
		 */
		_createViewModel: function() {
			return new JSONModel({
				isFilterBarVisible: false,
				filterBarLabel: "",
				delay: 0,
				title: this.getResourceBundle().getText("masterTitleCount", [0]),
				noDataText: this.getResourceBundle().getText("masterListNoDataText"),
				sortBy: "Aufnr",
				groupBy: "None"
			});
		},

		/**
		 * Ask for user confirmation to leave the edit page and discard all changes
		 * @param {object} fnLeave - handles discard changes
		 * @param {object} fnLeaveCancelled - handles cancel
		 * @private
		 */
		_leaveEditPage: function(fnLeave, fnLeaveCancelled) {
			var sQuestion = this.getResourceBundle().getText("warningConfirm");
			var sTitle = this.getResourceBundle().getText("warning");

			MessageBox.show(sQuestion, {
				icon: MessageBox.Icon.WARNING,
				title: sTitle,
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.OK) {
						fnLeave();
					} else if (fnLeaveCancelled) {
						fnLeaveCancelled();
					}
				}
			});
		},

		/**
		 * If the master route was hit (empty hash) we have to set
		 * the hash to to the first item in the list as soon as the
		 * listLoading is done and the first item in the list is known
		 * @private
		 */
		_onMasterMatched: function() {
			this._oListSelector.oWhenListLoadingIsDone.then(
				function(mParams) {
					if (mParams.list.getMode() === "None") {
						return;
					}
					this.getModel("appView").setProperty("/addEnabled", true);
					if (!mParams.list.getSelectedItem()) {
						this.getRouter().navTo("object", {
							Aufnr: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Aufnr")),
							Auart: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Auart")),
							Werks: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Werks")),
							Qmart: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Qmart")),
							Qmnum: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Qmnum")),
							Rbnr : encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Rbnr")),
							Aufpl: encodeURIComponent(mParams.firstListitem.getBindingContext().getProperty("Aufpl"))
						}, true);
					}
				}.bind(this),
				function(mParams) {
					if (mParams.error) {
						return;
					}
					this.getRouter().getTargets().display("detailNoObjectsAvailable");
				}.bind(this)
			);

			//Add jgiraldo 
			if (!this.filtroIngreso) {
				this.filtroIngreso = true;
				this.f_filtro_aviso('CC15', 'TEC-PV01');
			} else {
				var combo_puesto = sap.ui.getCore().getElementById("cmb_puesto_tra");
				var combo_centro = sap.ui.getCore().getElementById("cmb_centro");

				this._oList.getBinding("items").bClientOperation = false;
				this._oList.getBinding("items").sOperationMode = sap.ui.model.odata.OperationMode.Server;

				this.f_filtro_aviso(combo_centro.getSelectedKey(), combo_puesto.getSelectedKey());
			}
		},

		//Add Jhony
		_getDialog: function() {
			if (this.oPersonalizationDialog) {
				return this.oPersonalizationDialog;
			}

			// associate controller with the fragment
			this.oPersonalizationDialog = sap.ui.xmlfragment("com.corona.fragment.SelectCentroPuestoT", this);
			this.getView().addDependent(this.oPersonalizationDialog);
			return this.oPersonalizationDialog;
		},

		/**
		 * Shows the selected item on the detail page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showDetail: function(oItem) {
			var bReplace = !Device.system.phone;
			this.getRouter().navTo("object", {
				Aufnr: encodeURIComponent(oItem.getBindingContext().getProperty("Aufnr")),
				Auart: encodeURIComponent(oItem.getBindingContext().getProperty("Auart")),
				Werks: encodeURIComponent(oItem.getBindingContext().getProperty("Werks")),
				Qmart: encodeURIComponent(oItem.getBindingContext().getProperty("Qmart")),
				Qmnum: encodeURIComponent(oItem.getBindingContext().getProperty("Qmnum")),
				Rbnr : encodeURIComponent(oItem.getBindingContext().getProperty("Rbnr")),
				Aufpl: encodeURIComponent(oItem.getBindingContext().getProperty("Aufpl"))
			}, bReplace);
		},

		/**
		 * Sets the item count on the master list header
		 * @param {integer} iTotalItems the total number of items in the list
		 * @private
		 */
		_updateListItemCount: function(iTotalItems) {
			var sTitle;
			// only update the counter if the length is final
			if (this._oList.getBinding("items").isLengthFinal()) {
				sTitle = this.getResourceBundle().getText("masterTitleCount", [iTotalItems]);
				this.getModel("masterView").setProperty("/title", sTitle);
			}
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @private
		 */
		_applyFilterSearch: function() {
			var aFilters = this._oListFilterState.aSearch.concat(this._oListFilterState.aFilter),
				oViewModel = this.getModel("masterView");
			this._oList.getBinding("items").filter(aFilters, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (aFilters.length !== 0) {
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataWithFilterOrSearchText"));
			} else if (this._oListFilterState.aSearch.length > 0) {
				// only reset the no data text to default when no new search was triggered
				oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("masterListNoDataText"));
			}
		},

		/**
		 * Internal helper method to apply both group and sort state together on the list binding
		 * @private
		 */
		_applyGroupSort: function(aSorters) {
			this._oList.getBinding("items").sort(aSorters);
		},

		/**
		 * Internal helper method that sets the filter bar visibility property and the label's caption to be shown
		 * @param {string} sFilterBarText the selected filter value
		 * @private
		 */
		_updateFilterBar: function(sFilterBarText) {
			var oViewModel = this.getModel("masterView");
			oViewModel.setProperty("/isFilterBarVisible", (this._oListFilterState.aFilter.length > 0));
			oViewModel.setProperty("/filterBarLabel", this.getResourceBundle().getText("masterFilterBarText", [sFilterBarText]));
		},

		/**
		 * Internal helper method that adds "/" to the item's path 
		 * @private
		 */
		_fnGetPathWithSlash: function(sPath) {
			return (sPath.indexOf("/") === 0 ? "" : "/") + sPath;
		},

		/**
		 * It navigates to the saved itemToSelect item. After delete it navigate to the next item. 
		 * After add it navigates to the new added item if it is displayed in the tree. If not it navigates to the first item.
		 * @private
		 */
		_findItem: function() {
			var itemToSelect = this.getModel("appView").getProperty("/itemToSelect");
			if (itemToSelect) {
				var sPath = this._fnGetPathWithSlash(itemToSelect);
				var oItem = this._oListSelector.findListItem(sPath);
				if (!oItem) { //item is not viewable in the tree. not in the current tree page.
					oItem = this._oListSelector.findFirstItem();
					if (oItem) {
						sPath = oItem.getBindingContext().getPath();
					} else {
						this.getRouter().getTargets().display("detailNoObjectsAvailable");
						return;
					}
				}

				//Se comenta código Generado por el Template para que no muestre el detalle @netw.
				if (!Device.system.phone) {
					this._oListSelector.selectAListItem(sPath);
					this._showDetail(oItem);
				}
			}
		},

		f_filtro_aviso: function(p_centro, p_puesto) {

			//Add Jhony Giraldo
			var filters = [];
			var sFilter;
			var query = p_puesto;
			sFilter = new sap.ui.model.Filter("Arbpl", sap.ui.model.FilterOperator.EQ, query);
			filters.push(sFilter);

			query = p_centro;
			sFilter = new sap.ui.model.Filter("Werks", sap.ui.model.FilterOperator.EQ, query);
			filters.push(sFilter);

			var binding = this._oList.getBinding("items");
			binding.filter(filters);
		},

		f_get_puestos: function() {
			var combo_puesto = sap.ui.getCore().getElementById("cmb_puesto_tra");
			var combo_centro = sap.ui.getCore().getElementById("cmb_centro");

			combo_puesto.setBusy(true);

			var filters = [];
			var sFilter;
			var query = combo_centro.getSelectedKey();
			sFilter = new sap.ui.model.Filter("Werks", sap.ui.model.FilterOperator.EQ, query);
			filters.push(sFilter);
			var binding = combo_puesto.getBinding("items");
			binding.filter(filters);

			combo_puesto.setBusy(false);
		},

		f_close_dialogo_puest_centr: function() {
			var combo_puesto = sap.ui.getCore().getElementById("cmb_puesto_tra");
			var combo_centro = sap.ui.getCore().getElementById("cmb_centro");

			this._oList.getBinding("items").bClientOperation = false;
			this._oList.getBinding("items").sOperationMode = sap.ui.model.odata.OperationMode.Server;

			this.f_filtro_aviso(combo_centro.getSelectedKey(), combo_puesto.getSelectedKey());
			this.oPersonalizationDialog.close();
		},

		f_open_dialog_login: function() {
			//Agregar Dialogo
			var oPersonalizationDialog = this._getDialog();
			oPersonalizationDialog.open();
		},

		f_retornar_launchpad: function() {
			this.oPersonalizationDialog.close();
			// The history contains a previous entry
			history.go(-1);
		},

		f_buscar_avisos: function(evt) {
			if (!this.esprimerfiltro) {
				this._oList.getBinding("items").sOperationMode = sap.ui.model.odata.OperationMode.Client;

				var puesto_tra = sap.ui.getCore().getElementById("cmb_puesto_tra").getSelectedKey();
				var centro = sap.ui.getCore().getElementById("cmb_centro").getSelectedKey();

				this.f_filtro_aviso(centro, puesto_tra);
			}

			var filers = [],
				query = evt.getParameters().query,
				nameFilter = new sap.ui.model.Filter("Aufnr", sap.ui.model.FilterOperator.Contains, query);

			filers.push(nameFilter);

			nameFilter = new sap.ui.model.Filter("Qmnum", sap.ui.model.FilterOperator.Contains, query);
			filers.push(nameFilter);

			nameFilter = new sap.ui.model.Filter("Qmnum", sap.ui.model.FilterOperator.Contains, query);
			filers.push(nameFilter);

			var oFilter = new sap.ui.model.Filter({
				aFilters: filers,
				bAnd: false,
				_bMultiFilter: true
			});

			this._oList.getBinding("items").sOperationMode = sap.ui.model.odata.OperationMode.Client;
			this._oList.getBinding("items").filter([oFilter]);
		}
	});
});

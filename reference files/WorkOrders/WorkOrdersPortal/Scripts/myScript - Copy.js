var app = angular.module('myApp', ['ngRoute']);

app.directive('restrictInput', [function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var ele = element[0];
            var regex = RegExp(attrs.restrictInput);
            var value = ele.value;

            ele.addEventListener('keyup', function (e) {
                if (regex.test(ele.value)) {
                    value = ele.value;
                } else {
                    ele.value = value;
                }
            });
        }
    };
}]);

app.config(function ($routeProvider) {
    $routeProvider
        .when('/ChangePassword', {
            templateUrl: '/Home/ChangePassword',
            contoller: 'ctrl_changePassword'
        })
        .when('/AddDevice', {
            templateUrl: '/Home/AddDevice',
            contoller: 'ctrl_addDevice'
        })
        .when('/InactiveDevices', {
            templateUrl: '/Home/InactiveDevices',
            contoller: 'ctrl_inactiveDevices'
        })
        .when('/RegisterEmployee', {
            templateUrl: '/Home/RegisterEmployee',
            contoller: 'ctrl_registerEmployee'
        })
        .when('/ManageEmployees', {
            templateUrl: '/Home/ManageEmployees',
            contoller: 'ctrl_manageEmployees'
        })
        .when('/ManageTasks', {
            templateUrl: '/Home/ManageTasks',
            contoller: 'ctrl_managetasks'
        })
        .when('/AllocateTasks', {
            templateUrl: '/Home/AllocateTasks',
            contoller: 'ctrl_managetasks'
        })
        .when('/ViewInactiveEmployees', {
            templateUrl: '/Home/ViewInactiveEmployees',
            contoller: 'ctrl_viewInactiveEmployees'
        })
        .when('/AllocateDevice', {
            templateUrl: '/Home/AllocateDevice',
            contoller: 'ctrl_allocateDevice'
        })
        .when('/ReadingCodes', {
            templateUrl: '/Home/ReadingCodes',
            controller: 'ctrl_readingCodes'
        })
        .when('/WorkOrders', {
            templateUrl: '/Home/WorkOrders',
            controller: 'ctrl_readingCodes'
        })
});

app.controller('homeController', function ($scope, $log) {
});

app.controller('ctrl_addDevice', function ($scope, $log) {
    var self = this;
    var recordToEdit;

    self.CreateDevice = function () {
        console.log(self.device);
        $.ajax({
            type: "POST",
            url: "/Process/AddDevice",
            contentType: "application/json;charset=utf-8",
            data: JSON.stringify(self.device),
            success: function (result) {
                alert(result.json);
                self.GetDevices();
            }
        });
        self.ClearAddDeviceForm();
    }

    self.GetDevices = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetActiveDevices",
            success: function (result) {
                self.Devices = JSON.parse(result.json);
                dataset = self.Devices;
                var table = $('#deviceTable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "Name" },
                        { data: "SerialNumber" },
                        { data: "DeviceTag" },
                        { data: "PhoneNumber" },
                        { data: "Status" },
                        { data: "DeviceIMEI" },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button class="btn btn-info" id="edit">Edit</button>';
                            }
                        },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button class="btn btn-danger" id="deactivate">Deactivate</button>';
                            }
                        }
                    ],
                    "bDestroy": true
                });
                $('#deviceTable tbody').on('click', '#edit', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.Edit(data.DeviceTag)
                });
                $('#deviceTable tbody').on('click', '#deactivate', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.Deactivate(data.DeviceTag)
                });
            }
        });
    }

    self.Deactivate = function (id) {
        for (var i = 0; i < self.Devices.length; i++) {
            if (self.Devices[i].DeviceTag === id) {
                self.device = {
                    name: self.Devices[i].Name,
                    serialNumber: self.Devices[i].SerialNumber,
                    phoneNumber: self.Devices[i].PhoneNumber,
                    deviceTag: self.Devices[i].DeviceTag,
                    deviceIMEI: self.Devices[i].DeviceIMEI,
                    status: self.Devices[i].Status
                }
            }
        }

        var txt = confirm("Are you sure you want to deactivate Device of Tag " + id + " ?");
        if (txt == true) {
            $.ajax({
                type: "POST",
                url: "/Process/DeactivateDevice",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify(self.device),
                success: function (result) {
                    alert(result.json);
                    location.reload();
                }
            });
        }
    }

    self.ShowAddDevice = function () {
        self.ClearAddDeviceForm();
        $("#addDevice").show("fast");
    }

    self.HideAddDevice = function () {
        $("#addDevice").hide("fast");
    }

    self.ShowEditDevice = function () {
        $("#editDevice").show("fast");
    }

    self.HideEditDevice = function () {
        $("#editDevice").hide("fast");
    }

    self.Edit = function (id) {
        recordToEdit = id;
        self.ShowEditDevice();
        for (var i = 0; i < self.Devices.length; i++) {
            if (self.Devices[i].DeviceTag === id) {
                self.device = {
                    name: self.Devices[i].Name,
                    serialNumber: self.Devices[i].SerialNumber,
                    phoneNumber: self.Devices[i].PhoneNumber,
                    deviceImei: self.Devices[i].DeviceIMEI
                }
                $scope.$apply();
            }
        }
        $scope.editDeviceForm.$setDirty();
    }

    self.Modify = function () {
        self.device.deviceTag = recordToEdit;
        $.ajax({
            type: "POST",
            url: "/Process/EditDevice",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(self.device),
            success: function (result) {
                alert(result.json);
                self.GetDevices();
                location.reload();
            }
        });
        self.ClearEditDeviceForm();
    }

    self.ClearAddDeviceForm = function () {
        self.device = {
            name: '',
            phoneNumber: '',
            deviceTag: '',
            serialNumbr: ''
        }
        $scope.addDeviceForm.$setPristine();
    }

    self.ClearEditDeviceForm = function () {
        $scope.$apply(function () {
            self.device = {};
        });
        self.device = {
            name: '',
            phoneNumber: '',
            deviceTag: '',
            serialNumbr: ''
        }
        $scope.editDeviceForm.$setPristine();
    }
});

app.controller('ctrl_allocateDevice', function ($scope, $log) {
    var self = this;
    var recordToEdit;

    self.GetDeviceAllocations = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetDeviceAllocations",
            success: function (result) {
                self.DeviceAllocations = JSON.parse(result.json);
                dataset = self.DeviceAllocations;
                var table = $('#deviceAllocations').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "Emp_ID" },
                        { data: "Emp_Name" },
                        { data: "Name" },
                        { data: "DeviceTag" },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button class="btn btn-info" id="modify">Modify</button>';
                            }
                        }
                    ],
                    "bDestroy": true
                });

                $('#deviceAllocations tbody').on('click', '#modify', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.Modify(data.Emp_ID);
                });

                $scope.$apply();
            }
        });
    }

    // Get Devices
    self.GetAvailableDevices = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetAvailableDevices",
            success: function (result) {
                self.Devices = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }


    // Populate modify form
    self.Modify = function (id) {
        recordToEdit = id;
        self.ShowModify();
        for (var i = 0; i < self.DeviceAllocations.length; i++) {
            if (self.DeviceAllocations[i].Emp_ID === id) {
                self.allocation = {
                    emp_id: self.DeviceAllocations[i].Emp_ID,
                    current_device: self.DeviceAllocations[i].DeviceTag
                }
            }
        }
        $scope.$apply();
    }

    // Update device allocation in db
    self.UpdateDeviceAllocation = function () {
        $.ajax({
            type: "POST",
            url: "/Process/UpdateDeviceAllocation",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({ 'deviceTag': self.allocation.deviceTag, 'emp_id': recordToEdit }),
            success: function (result) {
                alert(result.json);
                location.reload();
            }
        });
    }

    // Deallocate device
    self.Deallocate = function () {
        var txt = confirm("Are you sure you want to deallocate Employee of id " + recordToEdit + " of their device ?");
        if (txt == true) {
            $.ajax({
                type: "POST",
                url: "/Process/DeallocateDevice",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify({ 'emp_id': recordToEdit }),
                success: function (result) {
                    alert(result.json);
                    location.reload();
                }
            });
        }
    }

    // Show or hide mod div
    self.ShowModify = function () {
        $("#modDiv").show("fast");
    }
    self.HideModify = function () {
        $("#modDiv").hide("fast");
    }

});

app.controller('ctrl_changePassword', function ($scope, $log) {
    var self = this;

    self.Save = function () {
        self.user.adminName = adminName;

        $.ajax({
            type: "POST",
            url: "/Process/ChangePassword",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(self.user),
            success: function (result) {
                alert(result.json);
            }
        });
        self.ClearChangePasswordForm();
    }

    self.ClearChangePasswordForm = function () {
        self.user = {
            adminName: '',
            new_password: '',
            confirm_pass: ''
        }
    }
});

app.controller('ctrl_downloadReport', function ($scope, $log) {
    var self = this;

    self.GetDownloadPeriod = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetDownloadPeriod",
            contentType: "application/json; charset=utf-8",
            success: function (result) {
                self.periods = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetDownloadReport = function (period) {
        $.ajax({
            type: "GET",
            url: "/Process/GetDownloadReports",
            contentType: "application/json; charset=utf-8",
            data: { 'period': period },
            success: function (result) {
                self.DownloadReports = JSON.parse(result.json);
                dataset = self.DownloadReports;
                var table = $('#downloadReportTable').DataTable({
                    data: dataset,
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    columns: [
                        { data: "Emp_ID" },
                        { data: "Emp_Name" },
                        { data: "Time" }
                    ],
                    "bDestroy": true
                });
            }
        });
    }

    //Show table
    self.ShowDownloadReportDiv = function () {
        document.getElementById("downloadReportDiv").style.display = "block";
    }

});

app.controller('ctrl_inactiveDevices', function ($scope, $log) {
    var self = this;

    self.GetInactiveDevices = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetInactiveDevices",
            success: function (result) {
                self.Devices = JSON.parse(result.json);
                dataset = self.Devices;
                var table = $('#inactiveDevicesTable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "Name" },
                        { data: "DeviceTag" },
                        { data: "PhoneNumber" },
                        { data: "SerialNumber" },
                        { data: "DeviceIMEI" },
                        { data: "Status" },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button id="activate" class="btn btn-info">Activate</button>';
                            }
                        },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button id="delete" class="btn btn-danger">Delete</button>';
                            }
                        }
                    ],
                    "bDestroy": true
                });

                $('#inactiveDevicesTable tbody').on('click', '#activate', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.ActivateDevice(data.DeviceTag);
                });

                $('#inactiveDevicesTable tbody').on('click', '#delete', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.DeleteDevice(data.DeviceTag);
                });

                $scope.$apply();
            }
        })
    }

    self.ActivateDevice = function (id) {
        for (var i = 0; i < self.Devices.length; i++) {
            if (self.Devices[i].DeviceTag === id) {
                self.device = {
                    name: self.Devices[i].Name,
                    phoneNumber: self.Devices[i].PhoneNumber,
                    deviceTag: self.Devices[i].DeviceTag,
                    serialNumber: self.Devices[i].SerialNumber,
                    status: self.Devices[i].Status
                }
            }
        }

        var txt = confirm("Are you sure you want to Activate Device of tag " + id + " ?");
        if (txt == true) {
            $.ajax({
                type: "POST",
                url: "/Process/ActivateDevice",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify(self.device),
                success: function (result) {
                    alert(result.json);
                    self.GetInactiveDevices();
                    location.reload();
                }
            });
        }
    }

    self.DeleteDevice = function (id) {
        for (var i = 0; i < self.Devices.length; i++) {
            if (self.Devices[i].DeviceTag === id) {
                self.device = {
                    name: self.Devices[i].Name,
                    phoneNumber: self.Devices[i].PhoneNumber,
                    deviceTag: self.Devices[i].DeviceTag,
                    serialNumber: self.Devices[i].SerialNumber,
                    status: self.Devices[i].Status
                }
            }
        }

        var txt = confirm("Are you sure you want to Delete Device of tag " + id + " ?");
        if (txt == true) {
            $.ajax({
                type: "POST",
                url: "/Process/DeleteDevice",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify(self.device),
                success: function (result) {
                    alert(result.json);
                    self.GetInactiveDevices();
                    location.reload();
                }
            });
        }
    }
});

app.controller('ctrl_manageEmployees', function ($scope, $log) {
    var self = this;
    var recordToEdit;

    self.getmajicsTechnicians = function () {
        $.ajax({
            type: "GET",
            url: "/Process/getmajicsTechnicians",
            success: function (result) {
                console.log(result);
                self.Majicstechnicians = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetAvailableDevices = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetAvailableDevices",
            success: function (result) {
                self.Devices = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.RegisterEmployee = function () {
        console.log(self.employee);

        $.ajax({
            type: "POST",
            url: "/Process/RegisterEmployee",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(self.employee),
            success: function (result) {
                alert(result.json);

                self.GetAvailableDevices();
                location.reload();
            }
        });


    }

    self.GetActiveEmployees = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetActiveEmployees",
            success: function (result) {
                self.Employees = JSON.parse(result.json);
                dataset = self.Employees;
                var table = $('#activeEmployeeTable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "Emp_ID" },
                        { data: "Emp_Name" },
                        { data: "Emp_Phone" },
                        { data: "Emp_Email" },
                        { data: "Emp_Status" },
                        { data: "DeviceTag" },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button class="btn btn-info" id="modify">Modify</button>';
                            }
                        },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button class="btn btn-danger" id="deactivate">Deactivate</button>';
                            }
                        }
                    ],
                    "bDestroy": true
                });


                $('#activeEmployeeTable tbody').on('click', '#modify', function () {
                    var data = table.row($(this).parents('tr')).data();
                    $("#registerDiv").show("fast");
                    self.populateEmployeeData(data);
                });

                $('#activeEmployeeTable tbody').on('click', '#deactivate', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.DeactivateEmployee(data.Emp_ID);
                });

                $('#activeEmployeeTable tbody').on('click', '#password', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.ChangePassword(data.Emp_ID);
                });
                $scope.$apply();
            }
        });
    }



    self.populateEmployeeData = function (data) {
        for (var key in data) {
            if (key.includes("hashK")) {
                console.log("key is invalid");
            } else {
                $scope.$apply(function () {
                    self.employee[key] = data[key];
                });
            }
        }
    }


 

    self.Password = function (id) {
        recordToEdit = id;
        self.HideModify();
        self.ShowPass();
        for (var i = 0; i < self.Employees.length; i++) {
            if (self.Employees[i].Emp_ID === id) {
                self.employee = {
                    emp_id: self.Employees[i].Emp_ID,
                    emp_name: self.Employees[i].Emp_Name,
                }
                $scope.$apply();
            }
        }
    }

    self.UpdateEmployee = function () {
        self.employee.editID = recordToEdit;
        $.ajax({
            type: "POST",
            url: "/Process/UpdateEmployee",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(self.employee),
            success: function (result) {
                alert(result.json);
                location.reload();
            }
        });
    }

    self.UpdateEmployeePassword = function () {
        self.employee.editID = recordToEdit;
        $.ajax({
            type: "POST",
            url: "/Process/UpdateEmployeePassword",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(self.employee),
            success: function (result) {
                alert(result.json);
                location.reload();
            }
        });
    }

    self.DeactivateEmployee = function (id) {
        for (var i = 0; i < self.Employees.length; i++) {
            if (self.Employees[i].Emp_ID === id) {
                self.employee = {
                    emp_id: self.Employees[i].Emp_ID,
                    emp_name: self.Employees[i].Emp_Name,
                    emp_password: self.Employees[i].Emp_Password,
                    emp_phone: self.Employees[i].Emp_Phone,
                    emp_email: self.Employees[i].Emp_Email
                }
            }
        }

        var txt = confirm("Are you sure you want to deactivate Employee of id " + id + " ?");
        if (txt == true) {
            $.ajax({
                type: "POST",
                url: "/Process/DeactivateEmployee",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify(self.employee),
                success: function (result) {
                    alert(result.json);
                    self.GetActiveEmployees();
                    location.reload();
                }
            });
        }
    }

    self.ChangePassword = function (id) {
        self.Password(id);
    }

    self.DeleteEmployee = function (id) {
        for (var i = 0; i < self.Employees.length; i++) {
            if (self.Employees[i].Emp_ID === id) {
                self.employee = {
                    emp_id: self.Employees[i].Emp_ID,
                    emp_name: self.Employees[i].Emp_Name,
                    emp_password: self.Employees[i].Emp_Password,
                    emp_phone: self.Employees[i].Emp_Phone,
                    emp_email: self.Employees[i].Emp_Email
                }
            }
        }

        var txt = confirm("Are you sure you want to delete Employee of id " + id + " ?");
        if (txt == true) {
            $.ajax({
                type: "POST",
                url: "/Process/DeleteEmployee",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify(self.employee),
                success: function (result) {
                    alert(result.json);
                    self.GetActiveEmployees();
                    location.reload();
                }
            });
        }
    }

    self.ShowModify = function () {
        $("#modDiv").show("fast");
        self.HidePass();
        self.HideRegisterEmployee();
    }
    self.HideModify = function () {
        $("#modDiv").hide("fast");
    }

    self.ShowPass = function () {
        $("#passDiv").show("fast");
        self.HideModify();
        self.HideRegisterEmployee();
    }
    self.HidePass = function () {
        $("#passDiv").hide("fast");
    }

    self.ShowRegisterEmployee = function () {
        $("#registerDiv").show("fast");
        self.ClearEmployeeForm();
        self.HidePass();
        self.HideModify();
    }
    self.HideRegisterEmployee = function () {
        $("#registerDiv").hide("fast");
    }

    self.ClearEmployeeForm = function () {
        self.employee = {
            emp_id: null,
            emp_name: null,
            emp_password: null,
            emp_phone: null,
            emp_email: null,
            emp_device: null
        }
    }
});

app.controller('ctrl_manageTasks', function ($scope, $log) {
    var self = this;
    self.task = {};

    self.ShowRegisterTask = function () {
        $("#registerDiv").show("fast");
        self.task = {};
    }

    self.HideModify = function () {
        self.task = {};
        $("#registerDiv").hide("fast");
    }

    self.createTask = function () {
        console.log(self.task);
        $.ajax({
            type: "POST",
            url: "/Process/createTask",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(self.task),
            success: function (result) {
                alert(result.json);
                location.reload();
            }
        });
    }

    self.getworkOrders = function () {
        console.log("getting the work orders");
        $.ajax({
            type: "GET",
            url: "/Process/gettheworkOrders",
            success: function (result) {
                //console.log(result);
                self.Devices = JSON.parse(result.json);
                dataset = self.Devices;
                var table = $('#taskstable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "OrderID" },
                        { data: "TaskType" },
                        { data: "OrderNR" },
                        { data: "OrderCategory" },
                        { data: "OrderDesc" },
                        { data: "AssignedTo" },
                        { data: "CreatedBy" },
                        { data: "AccountNo" },
                        { data: "CustomerName" },
                        { data: "TelNo" },
                        { data: "MeterNo" },
                        { data: "RouteName" },
                        { data: "ZoneName" }
                    ],
                    "bDestroy": true
                });
               

            }
        });
    }

    self.GetEmployees = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetActiveEmployeesWithDevices",
            contentType: "application/json; charset=utf-8",
            success: function (result) {
                console.log("employees");
                console.log(result);
                $scope.$apply(function () {
                    self.Employees = JSON.parse(result.json);
                });
            }
        });
    }


    self.filterorders = {};
    self.showEmployeeOrders = function () {
        self.filterorders.fromdate = $("#fromdate").val();
        console.log(self.filterorders);
        $.ajax({
            type: "POST",
            url: "/Process/filteremployeeWorkOrders",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(self.filterorders),
            success: function (result) {
                console.log(result);
                self.Devices = JSON.parse(result.json);
                dataset = self.Devices;
                var table = $('#taskstable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "OrderID" },
                        { data: "TaskType" },
                        { data: "OrderNR" },
                        { data: "OrderCategory" },
                        { data: "OrderDesc" },
                        { data: "AssignedTo" },
                        { data: "CreatedBy" },
                        { data: "AccountNo" },
                        { data: "CustomerName" },
                        { data: "TelNo" },
                        { data: "MeterNo" },
                        { data: "RouteName" },
                        { data: "ZoneName" }
                    ],
                    "bDestroy": true
                });


            }
        });
    }




    self.getNewTasks = function () {
        $.ajax({
            type: "GET",
            url: "/Process/getNewTasks",
            success: function (result) {
                console.log(result);
                self.Devices = JSON.parse(result.json);
                dataset = self.Devices;
                var table = $('#taskstable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "t_id" },
                        { data: "type" },
                        { data: "source" },
                        { data: "status" },
                        { data: "narration" },
                        { data: "employee" },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button class="btn btn-info" id="edit">Edit</button>';
                            }
                        }
                    ],
                    "bDestroy": true
                });
                $('#taskstable tbody').on('click', '#edit', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.populateTaskData(data);
                    $("#registerDiv").show("fast");
                });

            }
        });

    }

    self.getTasksToAllocate = function () {
        $.ajax({
            type: "GET",
            url: "/Process/getTasksToAllocate",
            success: function (result) {
                console.log(result);
                self.allocs = JSON.parse(result.json);
                dataset = self.allocs;
                var table = $('#taskstable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "task_id" },
                        { data: "type" },
                        { data: "source" },
                        { data: "status" },
                        { data: "narration" },
                        { data: "employee" },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button class="btn btn-info" id="allocatetask">Allocate</button>';
                            }
                        }
                    ],
                    "bDestroy": true
                });
                $('#taskstable tbody').on('click', '#allocatetask', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.populateTaskData(data);
                    $("#registerDiv").show("fast");
                });

            }
        });

    }

    self.populateTaskData = function (data) {
        for (var key in data) {
            if (key.includes("hashK")) {
                console.log("key is invalid");
            } else {
                $scope.$apply(function () {
                    self.task[key] = data[key];
                });
            }
        }
    }

    self.editTask = function () {
        $.ajax({
            type: "POST",
            url: "/Process/createTask",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(self.task),
            success: function (result) {
                alert(result.json);
                location.reload();
            }
        });
    }

    //get the technicians
    self.gettechnicians = function () {
        $.ajax({
            type: "GET",
            url: "/Process/gettechnicians",
            success: function (result) {
                console.log(result);
                self.technicians = JSON.parse(result.json);
            }
        });
    }

    //allocate a task... also sending sms to phone
    self.allocateToTech = function () {
        console.log(self.task);
        $.ajax({
            type: "POST",
            url: "/Process/allocateToTech",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(self.task),
            success: function (result) {
                console.log(result);
                //alert(result.json);
                // location.reload();
            }
        });
    }











});

app.controller('ctrl_readingCodes', function ($scope, $log) {
    var self = this;

    self.GetReadingCodes = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetReadingCodes",
            success: function (result) {
                self.MeterStatus = JSON.parse(result.json);
                dataset = self.MeterStatus;
                var table = $('#readingCodesTable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "ReadingCode" },
                        { data: "ReadingCodeDefn" },
                        { data: "ReadingQuality" },
                        { data: "CapturePhoto" },
                    ],
                    "bDestroy": true
                });
                $scope.$apply();
            }
        });
    }

});

app.controller('ctrl_statusReports', function ($scope, $log) {
    var self = this;

    var zoneNames = [];

    var totalMeterCountRoute = 0;
    var totalMeterCountZone = 0;
    var capturedMeterCountZone = 0;
    var capturedMeterCountRoute = 0;
    var pendingMeterCountRoute = 0;
    var pendingMeterCountZone = 0;

    self.GetZones = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetZones",
            success: function (result) {
                self.Zones = JSON.parse(result.json);
                zoneNames = self.Zones;
                $scope.$apply();
            }
        });
    }

    self.GetRoutesInZone = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetAllRoutesInZone",
            contentType: "application/json; charset=utf-8",
            data: { 'zone_id': self.status.zone_id },
            success: function (result) {
                self.Routes = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetPeriods = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetPeriods",
            success: function (result) {
                self.Periods = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetTotalMetersRoute = function (id) {
        $.ajax({
            type: "GET",
            url: "/Process/GetTotalMetersRoute",
            contentType: "application/json; charset=utf-8",
            data: { 'routeId': id },
            success: function (result) {

                self.totalMeters = JSON.parse(result.json);
                totalMeterCountRoute = parseInt(self.totalMeters[0].MeterCount);
                $scope.$apply();
            }
        });
    }

    self.GetTotalMetersZone = function (id) {
        $.ajax({
            type: "GET",
            url: "/Process/GetTotalMetersZone",
            contentType: "application/json; charset=utf-8",
            data: { 'zone_id': id },
            success: function (result) {

                self.totalMetersZone = JSON.parse(result.json);
                totalMeterCountZone = parseInt(self.totalMetersZone[0].CustomerCount);
                $scope.$apply();
            }
        });
    }

    self.GetZonesTotalCapturedPending = function (period) {
        var totalMeterCountPeriod = 0;
        var capturedMeterCountPeriod = 0;
        var pendingMeterCountPeriod = 0;
        $.ajax({
            type: "GET",
            url: "/Process/GetZonesTotalCapturedPending",
            contentType: "application/json; charset=utf-8",
            data: { 'period': period },
            success: function (result) {
                self.PeriodData = JSON.parse(result.json);

                for (var i = 0; i < self.PeriodData.length; i++) {
                    totalMeterCountPeriod += self.PeriodData[i].MetersTotal;
                    capturedMeterCountPeriod += self.PeriodData[i].MetersCaptured;
                    pendingMeterCountPeriod += self.PeriodData[i].MetersPending;
                }

                self.metersCapturedPeriodPercentage = ((capturedMeterCountPeriod / totalMeterCountPeriod) * 100).toFixed(2);
                self.metersPendingPeriodPercentage = ((pendingMeterCountPeriod / totalMeterCountPeriod) * 100).toFixed(2);

                self.metersCapturedPeriod = capturedMeterCountPeriod;
                self.metersPendingPeriod = pendingMeterCountPeriod;
                self.period = period;

                $scope.$apply();

                var graph = c3.generate({
                    bindto: '#graph',
                    size: {
                        height: 550
                    },
                    data: {
                        json: self.PeriodData,
                        keys: {
                            x: 'ZoneID',
                            value: ['MetersCaptured', 'MetersPending', 'MetersTotal']
                        },
                        type: 'bar'
                    },
                    axis: {
                        x: {
                            type: 'category',
                        }
                    },
                    color: {
                        pattern: ['#5bc0de', '#dc6460', '#428bca']
                    },
                    bar: {
                        width: {
                            ratio: 0.5
                        }
                    },
                    grid: {
                        y: {
                            show: true,
                            lines: [{ value: 0 }]
                        }
                    }
                });
            }
        });
        self.HideZoneData();
        self.HideRouteData();
        document.getElementById("graph").style.display = "block";
        $('#periodData').show('fast');
    }

    self.GetRoutesTotalCapturedPending = function (zoneID) {
        var totalMeterCountZone = 0;
        var capturedMeterCountZone = 0;
        var pendingMeterCountZone = 0;
        $.ajax({
            type: "GET",
            url: "/Process/GetRoutesTotalCapturedPending",
            contentType: "application/json; charset=utf-8",
            data: { 'zoneID': zoneID },
            success: function (result) {
                self.ZoneData = JSON.parse(result.json);

                for (var i = 0; i < self.PeriodData.length; i++) {
                    totalMeterCountZone += self.ZoneData[i].MetersTotal;
                    capturedMeterCountZone += self.ZoneData[i].MetersCaptured;
                    pendingMeterCountZone += self.ZoneData[i].MetersPending;
                }

                self.metersCapturedZonePercentage = ((capturedMeterCountZone / totalMeterCountZone) * 100).toFixed(2);
                self.metersPendingZonePercentage = ((pendingMeterCountZone / totalMeterCountZone) * 100).toFixed(2);

                $scope.$apply();

                var graph = c3.generate({
                    bindto: '#graph',
                    size: {
                        height: 550
                    },
                    data: {
                        json: self.ZoneData,
                        keys: {
                            x: 'RouteName',
                            value: ['MetersCaptured', 'MetersPending', 'MetersTotal']
                        },
                        type: 'bar'
                    },
                    axis: {
                        x: {
                            type: 'category',
                        }
                    },
                    color: {
                        pattern: ['#5bc0de', '#dc6460', '#428bca']
                    },
                    bar: {
                        width: {
                            ratio: 0.5
                        }
                    },
                    grid: {
                        y: {
                            show: true,
                            lines: [{ value: 0 }]
                        }
                    }
                });
            }
        });
        $('#zoneData').show('fast');
        document.getElementById("graph").style.display = "block";
    }

    self.GetPendingMetersRoute = function (id) {
        $.ajax({
            type: "GET",
            url: "/Process/GetPendingMetersRoute",
            contentType: "application/json; charset=utf-8",
            data: { 'routeId': id },
            success: function (result) {
                self.pendingMetersObj = JSON.parse(result.json);

                pendingMeterCountRoute = parseInt(self.pendingMetersObj[0].CustomerCount);
                self.metersPendingRoute = pendingMeterCountRoute;
                capturedMeterCountRoute = totalMeterCountRoute - pendingMeterCountRoute;
                self.metersCapturedRoute = capturedMeterCountRoute;

                self.metersPendingRoutePercentage = ((pendingMeterCountRoute / totalMeterCountRoute) * 100).toFixed(2);
                self.metersCapturedRoutePercentage = ((capturedMeterCountRoute / totalMeterCountRoute) * 100).toFixed(2);

                $scope.$apply();

                var graph = c3.generate({
                    bindto: '#graph',
                    size: {
                        height: 550
                    },
                    data: {
                        columns: [
                            ['Meters Captured', capturedMeterCountRoute],
                            ['Meters Pending', pendingMeterCountRoute]
                        ],
                        type: 'bar'
                    },
                    axis: {
                        x: {
                            type: 'category',
                            categories: [self.routeName]
                        }
                    },
                    color: {
                        pattern: ['#5bc0de', '#d9534f']
                    },
                    bar: {
                        width: {
                            ratio: 0.5
                        }
                    },
                    grid: {
                        y: {
                            show: true,
                            lines: [{ value: 0 }]
                        }
                    }
                });
            }
        });
        document.getElementById("graph").style.display = "block";
    }

    self.GetPendingMetersZone = function (id) {
        $.ajax({
            type: "GET",
            url: "/Process/GetPendingMetersZone",
            contentType: "application/json; charset=utf-8",
            data: { 'zone_id': id },
            success: function (result) {
                self.pendingMetersObj = JSON.parse(result.json);

                pendingMeterCountZone = parseInt(self.pendingMetersObj[0].CustomerCount);
                self.metersPendingZone = pendingMeterCountZone;
                capturedMeterCountZone = totalMeterCountZone - pendingMeterCountZone;
                self.metersCapturedZone = capturedMeterCountZone;

                $scope.$apply();
            }
        });
    }

    self.GetAssignedEmployee = function (id) {
        $.ajax({
            type: "GET",
            url: "/Process/GetEmployeeAssigned",
            contentType: "application/json; charset=utf-8",
            data: { 'routeId': id },
            success: function (result) {
                self.assignedEmployee = JSON.parse(result.json);

                if (self.assignedEmployee.length == 0) {
                    self.emp_name = "Unassigned";
                }
                else {
                    self.emp_name = self.assignedEmployee[0].Emp_Name;
                }

                $scope.$apply();
            }
        });
    }

    self.ShowRouteData = function (id) {
        $.ajax({
            type: "GET",
            url: "/Process/ShowRouteName",
            contentType: "application/json; charset=utf-8",
            data: { 'routeId': id },
            success: function (result) {
                self.routeNameObj = JSON.parse(result.json);
                self.routeName = self.routeNameObj[0].RouteName;
                $scope.$apply();
            }
        });

        self.HidePeriodData();
        self.HideZoneData();
        $('#routeData').show('fast');
    }

    self.ShowZoneData = function (id) {
        $.ajax({
            type: "GET",
            url: "/Process/ShowZoneID",
            contentType: "application/json; charset=utf-8",
            data: { 'zone_id': id },
            success: function (result) {
                self.zoneNameObj = JSON.parse(result.json);
                self.zoneID = self.zoneNameObj[0].ZoneID;
            }
        });

        self.HidePeriodData();
        self.HideRouteData();
        $('#zoneData').show('fast');
    }

    self.ShowPeriodData = function (periodID) {
        $.ajax({
            type: "GET",
            url: "/Process/ShowPeriod",
            contentType: "application/json; charset=utf-8",
            data: { 'periodID': periodID },
            success: function (result) {
                self.periodNameObj = JSON.parse(result.json);
                self.period = self.zoneNameObj[0].ZoneID;
            }
        });

        self.HideZoneData();
        self.HideRouteData();
        $('#periodData').show('fast');
    }

    self.HideZoneData = function () {
        $('#zoneData').hide('fast');
    }
    self.HideRouteData = function () {
        $('#routeData').hide('fast');
    }
    self.HidePeriodData = function () {
        $('#periodData').hide('fast');
    }
    self.HideGraph = function () {
        $('#graph').hide('fast');
    }

    self.ClearForm = function () {
        self.status.period = null;
        self.status.routeId = null;
        self.status.zone_id = null;
    }

    self.EnableRouteReport = function () {
        document.getElementById("routeReportBtn").disabled = false;
    }
});

app.controller('ctrl_employeeStatusReports', function ($scope, $log) {
    var self = this;

    self.GetPeriod = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetCurrentPeriod",
            success: function (result) {
                self.Periods = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetEmployeeName = function (id) {
        $.ajax({
            type: "GET",
            url: "/Process/GetEmployeeName",
            contentType: "application/json; charset=utf-8",
            data: { 'employeeID': id },
            success: function (result) {
                self.EmployeeName = JSON.parse(result.json);
                self.employee = self.EmployeeName[0].Emp_name;
                $scope.$apply();
            }
        });
    }

    self.GetEmployeesForPeriod = function (period) {
        $.ajax({
            type: "GET",
            url: "/Process/GetEmployeesForPeriod",
            contentType: "application/json; charset=utf-8",
            data: { 'period': period },
            success: function (result) {
                self.Employees = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetRoutesForEmployee = function (employeeID) {
        $.ajax({
            type: "GET",
            url: "/Process/GetEmployeeRoutes",
            contentType: "application/json; charset=utf-8",
            data: { 'employeeID': employeeID },
            success: function (result) {
                self.EmployeeRoutes = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetEmployeePeriodCapturedMeters = function (employeeID) {
        $.ajax({
            type: "GET",
            url: "/Process/GetEmployeeCapturedMeters",
            contentType: "application/json; charset=utf-8",
            data: { 'employeeID': employeeID },
            success: function (result) {
                self.MetersCaptured = JSON.parse(result.json);
                if (self.MetersCaptured[0] != null) {
                    self.status.metersCapturedPeriod = self.MetersCaptured[0].Count;
                }
                else {
                    self.status.metersCapturedPeriod = 0;
                }

                $scope.$apply();
            }
        });

        $('#employeePeriodData').show('fast');
        $('#employeeRouteData').hide('fast');
    }

    self.GetEmployeeRouteCapturedMeters = function (routeID) {
        $.ajax({
            type: "GET",
            url: "/Process/GetEmployeeCapturedMetersRoute",
            contentType: "application/json; charset=utf-8",
            data: { 'routeID': routeID },
            success: function (result) {
                self.MetersCapturedRoute = JSON.parse(result.json);
                self.status.metersCapturedRoute = self.MetersCapturedRoute[0].Count;
                $scope.$apply();
            }
        });

        $('#employeeRouteData').show('fast');
        $('#employeePeriodData').hide('fast');
    }

    self.GetEmployeePeriodPendingMeters = function (employeeID) {
        $.ajax({
            type: "GET",
            url: "/Process/GetTotalMetersForEmployee",
            contentType: "application/json; charset=utf-8",
            data: { 'employeeID': employeeID },
            success: function (result) {

                self.MetersTotal = JSON.parse(result.json);

                var totalMeters = parseInt(self.MetersTotal.length);
                var capturedMeters = parseInt(self.status.metersCapturedPeriod);
                var pendingMeters = totalMeters - capturedMeters;

                self.status.metersPendingPeriod = pendingMeters;
                self.status.metersPendingPeriodPercentage = ((pendingMeters / totalMeters) * 100).toFixed(2);
                self.status.metersCapturedPeriodPercentage = ((capturedMeters / totalMeters) * 100).toFixed(2);

                var graph = c3.generate({
                    bindto: '#employeeGraph',
                    size: {
                        height: 550
                    },
                    data: {
                        columns: [
                            ['Meters Captured', capturedMeters],
                            ['Meters Pending', pendingMeters]
                        ],
                        type: 'bar'
                    },
                    axis: {
                        x: {
                            type: 'category',
                            categories: [employeeID]
                        }
                    },
                    color: {
                        pattern: ['#5bc0de', '#d9534f']
                    },
                    bar: {
                        width: {
                            ratio: 0.5
                        }
                    },
                    grid: {
                        y: {
                            show: true,
                            lines: [{ value: 0 }]
                        }
                    }
                });

                $scope.$apply();
            }
        });

        $('#employeeRouteData').hide('fast');
        $('#employeePeriodData').show('fast');
        document.getElementById("employeeGraph").style.display = "block";
    }

    self.GetEmployeeRoutePendingMeters = function (routeID) {
        $.ajax({
            type: "GET",
            url: "/Process/GetEmployeePendingMetersRoute",
            contentType: "application/json; charset=utf-8",
            data: { 'routeID': routeID },
            success: function (result) {

                self.PendingMetersTotal = JSON.parse(result.json);
                self.status.metersPendingRoute = self.PendingMetersTotal[0].Count;

                var pendingMetersRoute = self.status.metersPendingRoute;
                var capturedMetersRoute = self.status.metersCapturedRoute;
                var totalMetersRoute = pendingMetersRoute + capturedMetersRoute;

                self.status.metersPendingRoutePercentage = ((pendingMetersRoute / totalMetersRoute) * 100).toFixed(2);
                self.status.metersCapturedRoutePercentage = ((capturedMetersRoute / totalMetersRoute) * 100).toFixed(2);

                var graph = c3.generate({
                    bindto: '#employeeGraph',
                    size: {
                        height: 550
                    },
                    data: {
                        columns: [
                            ['Meters Captured', capturedMetersRoute],
                            ['Meters Pending', pendingMetersRoute]
                        ],
                        type: 'bar'
                    },
                    axis: {
                        x: {
                            type: 'category',
                            categories: [routeID]
                        }
                    },
                    color: {
                        pattern: ['#5bc0de', '#d9534f']
                    },
                    bar: {
                        width: {
                            ratio: 0.5
                        }
                    },
                    grid: {
                        y: {
                            show: true,
                            lines: [{ value: 0 }]
                        }
                    }
                });

                $scope.$apply();
            }
        });

        $('#employeePeriodData').hide('fast');
        $('#employeeRouteData').show('fast');
        document.getElementById("employeeGraph").style.display = "block";
    }

    self.GetMeterCountByCode = function (employeeID, routeID) {
        if (routeID == null) {
            $.ajax({
                type: "GET",
                url: "/Process/GetMeterCountByCodePeriod",
                contentType: "application/json; charset=utf-8",
                data: { 'employeeID': employeeID },
                success: function (result) {

                    self.MeterCountByCode = JSON.parse(result.json);

                    var graph = c3.generate({
                        bindto: '#employeeGraph',
                        size: {
                            height: 550
                        },
                        data: {
                            json: self.MeterCountByCode,
                            keys: {
                                x: 'ReadingCode',
                                value: ['Count']
                            },
                            type: 'bar'
                        },
                        axis: {
                            x: {
                                type: 'category',
                            }
                        },
                        color: {
                            pattern: ['#428bca']
                        },
                        bar: {
                            width: {
                                ratio: 0.5
                            }
                        },
                        grid: {
                            y: {
                                show: true,
                                lines: [{ value: 0 }]
                            }
                        }
                    });

                    $scope.$apply();
                }
            });
        }
        else {
            $.ajax({
                type: "GET",
                url: "/Process/GetMeterCountByCodeRoute",
                contentType: "application/json; charset=utf-8",
                data: { 'employeeID': employeeID, 'routeID': routeID },
                success: function (result) {

                    self.MeterCountByCode = JSON.parse(result.json);

                    var graph = c3.generate({
                        bindto: '#employeeGraph',
                        size: {
                            height: 550
                        },
                        data: {
                            json: self.MeterCountByCode,
                            keys: {
                                x: 'ReadingCode',
                                value: ['Count']
                            },
                            type: 'bar'
                        },
                        axis: {
                            x: {
                                type: 'category',
                            }
                        },
                        color: {
                            pattern: ['#428bca']
                        },
                        bar: {
                            width: {
                                ratio: 0.5
                            }
                        },
                        grid: {
                            y: {
                                show: true,
                                lines: [{ value: 0 }]
                            }
                        }
                    });

                    $scope.$apply();
                }
            });
        }
        document.getElementById("employeeGraph").style.display = "block";
    }

    self.ClearForm = function () {
        self.status.period = null;
        self.status.employee = null;
        self.status.routeID = null;
    }

    self.HideEmployeePeriodData = function () {
        $('#employeePeriodData').hide('fast');
    }

    self.HideEmployeeRouteData = function () {
        $('#employeeRouteData').hide('fast');
    }

    self.HideGraph = function () {
        $('#employeeGraph').hide('fast');
    }
});

app.controller('ctrl_viewInactiveEmployees', function ($scope, $log) {
    var self = this;

    self.GetInactiveEmployees = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetInactiveEmployees",
            success: function (result) {
                self.Employees = JSON.parse(result.json);
                dataset = self.Employees;
                var table = $('#inactiveEmployeeTable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "Emp_ID" },
                        { data: "Emp_Name" },
                        { data: "Emp_Phone" },
                        { data: "Emp_Email" },
                        { data: "Emp_Status" },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button id="activate" class="btn btn-info">Activate</button>';
                            }
                        }
                    ],
                    "bDestroy": true
                });

                $('#inactiveEmployeeTable tbody').on('click', '#activate', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.ActivateEmployee(data.Emp_ID);
                });
                $scope.$apply();
            }
        });
    }

    self.ActivateEmployee = function (id) {
        for (var i = 0; i < self.Employees.length; i++) {
            if (self.Employees[i].Emp_ID === id) {
                self.employee = {
                    emp_id: self.Employees[i].Emp_ID,
                    emp_name: self.Employees[i].Emp_Name,
                    emp_password: self.Employees[i].Emp_Password,
                    emp_phone: self.Employees[i].Emp_Phone,
                    emp_email: self.Employees[i].Emp_Email
                }
            }
        }

        var txt = confirm("Are you sure you want to Activate Employee of id " + id + " ?");
        if (txt == true) {
            $.ajax({
                type: "POST",
                url: "/Process/ActivateEmployee",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify(self.employee),
                success: function (result) {
                    alert(result.json);
                    self.GetInactiveEmployees();
                    location.reload();
                }
            });
        }
    }
});

app.controller('ctrl_viewRoutes', function ($scope, $log) {
    var self = this;

    self.GetRoutes = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetRoutes",
            success: function (result) {
                self.Routes = JSON.parse(result.json);
                dataset = self.Routes;
                $('#routesTable').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "RouteID" },
                        { data: "RouteName" },
                        { data: "ZoneID" },
                    ]
                });
            }
        });
    }
});

app.controller('ctrl_viewAssignedRoutes', function ($scope, $log) {
    var self = this;

    self.GetZones = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetZones",
            success: function (result) {
                self.Zones = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetEmployees = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetActiveEmployeesWithDevices",
            contentType: "application/json; charset=utf-8",
            success: function (result) {
                self.Employees = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetRoutesInZone = function (id) {
        $.ajax({
            type: "GET",
            url: "/Process/GetAvailableRoutesInZone",
            contentType: "application/json; charset=utf-8",
            data: { 'zone_id': self.allocation.zone_id },
            success: function (result) {
                self.Routes = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.AssignRoute = function () {
        $.ajax({
            type: "POST",
            url: "/Process/AssignRoute",
            contentType: "application/json;charset=utf-8",
            data: JSON.stringify(self.allocation),
            success: function (result) {
                alert(result.json);
                self.ClearAssignRoutesForm();
                location.reload();
            }
        });

    }

    self.ClearAssignRoutesForm = function () {
        self.allocation = {
            zone_id: '',
            emp_id: '',
            route_id: ''
        }
        $scope.assignRoutesForm.$setPristine();
    }

    self.GetPeriod = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetPeriod",
            contentType: "application/json; charset=utf-8",
            success: function (result) {
                self.Periods = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.GetAssignedRoutes = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetAssignedRoutes",
            success: function (result) {
                self.AssignedRoutes = JSON.parse(result.json);
                dataset = self.AssignedRoutes;
                var table = $('#assignedRoutes').DataTable({
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    data: dataset,
                    columns: [
                        { data: "RouteID" },
                        { data: "RouteName" },
                        { data: "Emp_ID" },
                        { data: "Emp_Name" },
                        { data: "Period" },
                        {
                            data: null,
                            render: function (data, type, row) {
                                return '<button class="btn btn-danger" id="delete">Delete</button>';
                            }
                        }
                    ],
                    "bDestroy": true
                });

                $('#assignedRoutes tbody').on('click', '#delete', function () {
                    var data = table.row($(this).parents('tr')).data();
                    self.DeleteAssignedRoute(data.RouteID);
                });
                $scope.$apply();
            }
        });
    }

    self.DeleteAssignedRoute = function (id) {
        var txt = confirm("Are you sure you want to delete Assigned route of id " + id + " ?");
        if (txt == true) {
            $.ajax({
                type: "POST",
                url: "/Process/DeleteAssignedRoute",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify({ 'routeId': id }),
                success: function (result) {
                    alert(result.json);
                    location.reload();
                    self.GetAssignedRoutes();
                }
            });
        }

    }

    self.ShowAssignRoute = function () {
        $("#assignRoute").show("fast");
    }
    self.HideAssignRoute = function () {
        $("#assignRoute").hide("fast");
    }
});

app.controller('ctrl_viewReadings', function ($scope, $log) {
    var self = this;

    self.GetZones = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetZones",
            success: function (result) {
                self.Zones = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }



    self.GetPeriod = function () {
        $.ajax({
            type: "GET",
            url: "/Process/GetPeriod",
            contentType: "application/json; charset=utf-8",
            success: function (result) {
                self.Periods = JSON.parse(result.json);
                $scope.$apply();
            }
        });
    }

    self.Readings = [];

    self.GetReadings = function (id, period) {
        self.Readings = [];
        $.ajax({
            type: "GET",
            url: "/Process/GetReadings",
            contentType: "application/json; charset=utf-8",
            data: { 'routeId': id, 'period': period },
            success: function (result) {
                console.log(result);

                self.Readings = JSON.parse(result.json);
                self.HideDetailedReading();

                dataset = self.Readings;

                var table = $('#capturedReadingsTable').DataTable({
                    data: self.Readings,
                    dom: 'Bflirtp',
                    'buttons': [
                        'pdf',
                        'excel',
                        'print'
                    ],
                    columnDefs: [{
                        targets: 0,
                        data: null,
                        defaultContent: '',
                        orderable: false,
                        className: 'select-checkbox'
                    }],
                    columns: [
                        { data: '' },
                        { data: "AccountNo" },
                        { data: "MeterNo" },
                        { data: "CustomerName" },
                        { data: "Period" },
                        { data: "ReadingCode" },
                        { data: "PreviousReading" },
                        { data: "CurrentReading" },
                        { data: "ReadingDate" }
                    ],
                    select: {
                        style: 'os',
                        selector: 'td:first-child'
                    },
                    order: [[1, 'asc']],
                    destroy: true
                });

                var imagePath, customerName, reading;

                table.on('deselect', function (e, dt, type, indexes) {
                    if (type === 'row') {
                        self.HideDetailedReading();
                    }

                });

                table.on('select', function (e, dt, type, indexes) {
                    if (type === 'row') {
                        var data = table.rows(indexes).data();
                        var myData = data[0];

                        if (myData == null) {
                            $log.log("Undefined");
                        }
                        else {
                            console.log(myData);
                            $('#accountNumber').text(myData.AccountNo);
                            $('#customerName').text(myData.CustomerName);
                            $('#meterNumber').text(myData.MeterNo);
                            $('#previousReading').text(myData.PreviousReading);
                            $('#currentReading').text(myData.CurrentReading);
                            $('#readingCode').text(myData.ReadingCode);
                            $('#periodName').text(myData.Period);
                            $('#readingDate').text(myData.ReadingDate);
                            $('#meterReader').text(myData.MtrReader);
                            $('#device').text(myData.DeviceTag);
                            $('#photo').attr('src', "../" + myData.ImagePath).height(200).width(200);
                            $('#mapLink').html('<a href ="https://www.google.com/maps/place/' + myData.ReadingLatitude + ',%20' + myData.ReadingLongitude + '" target="_blank">View Map </a>');

                            imagePath = "../" + myData.ImagePath;
                            customerName = myData.CustomerName;
                            reading = myData.CurrentReading;
                            var imagename = myData.CustomerID + "_" + myData.Period;
                            getImage(imagename);
                            document.getElementById("detailedReading").style.display = "block";
                        }
                    }
                });

                $('#photo').click(function () {
                    $('#modalImage').attr('src', imagePath).height(400).width(400);
                    $('#customerPhotoName').text(customerName);
                    $('#photoCurrentReading').html("<b>Captured Reading:</b>" + reading);

                    $('#imageModal').modal('show');
                });

                $('#rotate').click(function () {
                    var image = $('#modalImage');
                    if (image.hasClass('north')) {
                        image.attr('class', 'west');
                    } else if (image.hasClass('west')) {
                        image.attr('class', 'south');
                    } else if (image.hasClass('south')) {
                        image.attr('class', 'east');
                    } else if (image.hasClass('east')) {
                        image.attr('class', 'north');
                    } else {
                        image.attr('class', 'north');
                    }
                });

                $('#zoomIn').click(function () {
                    $('#modalImage').width($('#modalImage').width() + 30);
                    $('#modalImage').height($('#modalImage').height() + 30);
                });

                $('#zoomOut').click(function () {
                    $('#modalImage').width($('#modalImage').width() - 30);
                    $('#modalImage').height($('#modalImage').height() - 30);
                });
            }
        });
    }



    self.ClearReadingsForm = function () {
        self.readings = {
            zone_id: '',
            routeId: '',
            period: ''
        }
        $scope.readingsForm.$setPristine();
        document.getElementById("detailedReading").style.display = "none";
        document.getElementById("readingsDiv").style.display = "none";
    }

    self.ShowReadingsDiv = function () {
        $('#readingsDiv').show('fast');
    }

    self.HideDetailedReading = function () {
        document.getElementById("detailedReading").style.display = "none";
    }
});

function getImage(imagename) {
    $.ajax({
        type: "GET",
        url: "/Process/getReadingImage/" + imagename,
        success: function (result) {
            $('#photo').attr('src', "data:image/jpg;base64," + result);
        }
    });
}
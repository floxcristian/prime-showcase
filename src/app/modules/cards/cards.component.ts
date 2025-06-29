// Angular
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// PrimeNG
import { MessageService } from 'primeng/api';
import {
  AutoComplete,
  AutoCompleteSelectEvent,
  AutoCompleteCompleteEvent,
} from 'primeng/autocomplete';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { PrimeNG } from 'primeng/config';
import { DividerModule } from 'primeng/divider';
import {
  FileSelectEvent,
  FileUpload,
  FileUploadEvent,
} from 'primeng/fileupload';
import { InputNumber } from 'primeng/inputnumber';
import { InputOtp } from 'primeng/inputotp';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { MultiSelectModule } from 'primeng/multiselect';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { RadioButton } from 'primeng/radiobutton';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Slider } from 'primeng/slider';
import { Tag } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { Permission } from './models/permission.interface';

const NG_MODULES = [CommonModule, FormsModule, RouterModule];
const PRIME_MODULES = [
  AutoComplete,
  AvatarModule,
  AvatarGroupModule,
  BadgeModule,
  ButtonModule,
  CardModule,
  Checkbox,
  DividerModule,
  FileUpload,
  InputNumber,
  InputOtp,
  InputTextModule,
  MenuModule,
  MultiSelectModule,
  OverlayBadgeModule,
  RadioButton,
  Select,
  SelectButton,
  Slider,
  Tag,
  ToggleSwitchModule,
  TooltipModule,
];

@Component({
  selector: 'app-cards',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './cards.component.html',
  styleUrl: './cards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  host: {
    class: 'flex-1 h-full overflow-hidden',
  },
})
export class CardsComponent {
  files: File[] = [];
  uploadedFiles: File[] = [];
  totalSize: number = 0;
  totalSizePercent: number = 0;
  jobApplication: boolean = false;
  userProfiles: string = 'Chilling';
  userProfilesOptions: string[] = ['Chilling', 'Do Not Disturb'];
  userProfilesValues: boolean[] = [true, true, false, false, true, false];
  forgotPasswordOTP: string = '023';
  priceRange: number[] = [0, 10000];
  priceMinVal: number = 0;
  priceMaxVal: number = 100000;
  priceRangePopularSpecs: any;
  priceRangePopularSpecsChecked: string[] = [
    'Furnished',
    'Detached',
    'Balcony',
    'Sea view',
  ];
  userSelectButtonOptions: string[] = ['Joined', 'Hosted'];
  selectedUserSelectButtonOption: string = 'Joined';
  selectedFrequency: string = 'weekly';
  darkMode: boolean = false;
  emailChips: any;
  memberSelectedTypes: string[] = ['O', 'E', 'V'];
  memberTypes: any;
  copiedText: string = "https://www.example.com/shared-files/user123/document-collection/file12345";
  documentName: string = 'Aura Theme';
  filesTag: string[] = ['ui', 'redesign', 'dashboard'];
  selectedPermission: string = 'Everyone';
  permissions: Permission[] = [];
  items: any;

  constructor(
    private config: PrimeNG,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.priceRangePopularSpecs = [
      { value: 'Furnished', checked: true },
      { value: 'Unfurnished', checked: false },
      { value: 'Detached', checked: true },
      { value: 'Underfloor heating', checked: false },
      { value: 'Balcony', checked: true },
      { value: 'Duplex', checked: false },
      { value: 'Triplex', checked: false },
      { value: 'Garden', checked: false },
      { value: 'Central location', checked: false },
      { value: 'Sea view', checked: true },
    ];
    
    this.memberTypes = [
      { name: 'Owner', code: 'O' },
      { name: 'Editor', code: 'E' },
      { name: 'Viewer', code: 'V' },
    ];

    this.permissions = [
      { name: 'Everyone', icon: 'pi pi-globe', key: 'E' },
      { name: 'Admins only', icon: 'pi pi-users', key: 'A' },
    ];
  }

  onRemoveTemplatingFile(
    file: File,
    removeFileCallback: any,
    index: number
  ): void {
    removeFileCallback(index);
    this.totalSize -= parseInt(this.formatSize(file.size));
    this.totalSizePercent = this.totalSize / 10;
  }

  onSelectedFiles(event: FileSelectEvent): void {
    this.files = event.files;
    this.files.forEach((file) => {
      this.totalSize += parseInt(this.formatSize(file.size));
    });
  }

  uploadEvent(callback: any): void {
    this.totalSizePercent = this.totalSize / 10;
    callback();
  }

  onTemplatedUpload(event: FileUploadEvent): void {
    for (let file of event.files) {
      this.uploadedFiles.push(file);
    }
    this.messageService.add({
      severity: 'info',
      summary: 'Success',
      detail: 'File Uploaded',
      life: 3000,
    });
  }

  formatSize(bytes: number): string {
    const k = 1024;
    const dm = 3;
    const sizes = this.config.translation.fileSizeTypes || [];

    if (bytes === 0) {
      return `0 ${sizes[0]}`;
    }

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${formattedSize} ${sizes[i]}`;
  }

  search(event: AutoCompleteSelectEvent): void {
    this.items = [...Array(10).keys()].map((item) => '-' + item);
  }

  search2(event: AutoCompleteCompleteEvent): void {
    this.items = [...Array(10).keys()].map((item) => event.query + '-' + item);
  }

  getObjectURL(file: File): string {
    return URL.createObjectURL(file);
  }

  getPermissionIcon(permissionName: string): string {
    const permission = this.permissions.find(p => p.name === permissionName);
    return permission ? permission.icon : 'pi pi-question';
  }
}